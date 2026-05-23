-- Add FOR UPDATE to the `stale` CTE in replace_scheduled_session_overrides
-- to close a race window with concurrent exercise_log inserts.
--
-- El RPC original (114) lockeaba en (client, date) via advisory pero el
-- SELECT que materializaba `stale` no tenía FOR UPDATE. Una INSERT
-- concurrente en exercise_logs apuntando a una fila stale (vía
-- upsert_scheduled_session, que usa lock key distinto) podía:
--   - ocurrir DESPUÉS del EXISTS de la CTE (has_logs=false) pero ANTES
--     del DELETE → la fila se borra y cascadea el log recién creado.
--
-- FOR UPDATE en `stale` toma row-level locks que conflictan con el FK
-- check de exercise_logs.scheduled_session_id en INSERT. Las inserts
-- esperan a que nuestro RPC commitee:
--   - Si demoteamos: la inserción del log encuentra la fila como
--     prescribed_by='client'. FK passes. Semánticamente correcto.
--   - Si borramos: el FK check falla limpio. El cliente recibe un
--     error en vez de perder silenciosamente su log.

DROP FUNCTION IF EXISTS replace_scheduled_session_overrides(
    TEXT, BIGINT, UUID, DATE, UUID, JSONB, JSONB
);

CREATE OR REPLACE FUNCTION replace_scheduled_session_overrides(
    p_tenant_host TEXT,
    p_client_id BIGINT,
    p_trainer_id UUID,
    p_scheduled_date DATE,
    p_session_id UUID,
    p_exercises JSONB,
    p_sets JSONB
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
    v_scheduled_session_id UUID;
    v_lock_key BIGINT;
    v_ex_orders INT[];
    v_set_orders INT[];
    v_missing INT[];
BEGIN
    IF p_session_id IS NULL THEN
        RAISE EXCEPTION 'p_session_id no puede ser NULL'
            USING ERRCODE = '22023';
    END IF;

    IF jsonb_array_length(p_sets) > 0 THEN
        SELECT array_agg(DISTINCT (e->>'exerciseOrder')::INT)
        INTO v_ex_orders
        FROM jsonb_array_elements(p_exercises) AS e;

        SELECT array_agg(DISTINCT (s->>'exerciseOrder')::INT)
        INTO v_set_orders
        FROM jsonb_array_elements(p_sets) AS s;

        SELECT array_agg(o) INTO v_missing
        FROM unnest(COALESCE(v_set_orders, ARRAY[]::INT[])) AS o
        WHERE NOT (o = ANY(COALESCE(v_ex_orders, ARRAY[]::INT[])));

        IF v_missing IS NOT NULL AND array_length(v_missing, 1) > 0 THEN
            RAISE EXCEPTION
                'replace_scheduled_session_overrides: p_sets refers to exerciseOrder(s) % not present in p_exercises',
                v_missing
                USING ERRCODE = 'check_violation';
        END IF;
    END IF;

    v_lock_key := hashtextextended(
        p_client_id::text || ':' || p_scheduled_date::text, 0
    );
    PERFORM pg_advisory_xact_lock(v_lock_key);

    SELECT id INTO v_scheduled_session_id
    FROM scheduled_sessions
    WHERE client_id = p_client_id
      AND scheduled_date = p_scheduled_date
      AND session_id = p_session_id
    FOR UPDATE;

    IF v_scheduled_session_id IS NULL THEN
        INSERT INTO scheduled_sessions(
            tenant_host, client_id, trainer_id, session_id,
            scheduled_date, status, prescribed_by
        )
        VALUES (
            p_tenant_host, p_client_id, p_trainer_id, p_session_id,
            p_scheduled_date, 'scheduled', 'trainer'
        )
        RETURNING id INTO v_scheduled_session_id;
    ELSE
        UPDATE scheduled_sessions
        SET status = 'scheduled',
            prescribed_by = 'trainer',
            updated_at = NOW()
        WHERE id = v_scheduled_session_id;
    END IF;

    -- Reconciliar stale trainer pins.
    -- FOR UPDATE en `stale` lockea las filas durante toda la transacción
    -- del RPC. Concurrent inserts a exercise_logs apuntando a estas
    -- filas bloquean en el FK check hasta nuestro commit.
    WITH stale AS (
        SELECT ss.id,
               EXISTS(
                 SELECT 1 FROM exercise_logs el
                 WHERE el.scheduled_session_id = ss.id
               ) AS has_logs
        FROM scheduled_sessions ss
        WHERE ss.client_id = p_client_id
          AND ss.scheduled_date = p_scheduled_date
          AND ss.prescribed_by = 'trainer'
          AND ss.id != v_scheduled_session_id
        FOR UPDATE
    ),
    demoted AS (
        UPDATE scheduled_sessions ss
        SET prescribed_by = 'client',
            updated_at = NOW()
        FROM stale
        WHERE ss.id = stale.id AND stale.has_logs = true
        RETURNING ss.id
    )
    DELETE FROM scheduled_sessions ss
    USING stale
    WHERE ss.id = stale.id AND stale.has_logs = false;

    DELETE FROM scheduled_session_exercises
    WHERE scheduled_session_id = v_scheduled_session_id;

    IF jsonb_array_length(p_exercises) > 0 THEN
        INSERT INTO scheduled_session_exercises(
            tenant_host, scheduled_session_id, exercise_id, exercise_order,
            sets, reps, weight_kg,
            duration_seconds, distance_meters, rest_seconds, notes
        )
        SELECT
            p_tenant_host,
            v_scheduled_session_id,
            (e->>'exerciseId')::UUID,
            (e->>'exerciseOrder')::INT,
            NULLIF(e->>'sets', '')::INT,
            NULLIF(e->>'reps', ''),
            NULLIF(e->>'weightKg', '')::DECIMAL,
            NULLIF(e->>'durationSeconds', '')::INT,
            NULLIF(e->>'distanceMeters', '')::DECIMAL,
            NULLIF(e->>'restSeconds', '')::INT,
            NULLIF(e->>'notes', '')
        FROM jsonb_array_elements(p_exercises) AS e;
    END IF;

    IF jsonb_array_length(p_sets) > 0 THEN
        INSERT INTO scheduled_session_exercise_sets(
            tenant_host, scheduled_session_exercise_id,
            set_number, reps, weight_kg
        )
        SELECT
            p_tenant_host,
            sse.id,
            (s->>'setNumber')::INT,
            NULLIF(s->>'reps', ''),
            NULLIF(s->>'weightKg', '')::DECIMAL
        FROM jsonb_array_elements(p_sets) AS s
        JOIN scheduled_session_exercises sse
            ON sse.scheduled_session_id = v_scheduled_session_id
           AND sse.exercise_order = (s->>'exerciseOrder')::INT;
    END IF;

    RETURN v_scheduled_session_id;
END;
$$;

GRANT EXECUTE ON FUNCTION replace_scheduled_session_overrides(
    TEXT, BIGINT, UUID, DATE, UUID, JSONB, JSONB
) TO anon, authenticated;
