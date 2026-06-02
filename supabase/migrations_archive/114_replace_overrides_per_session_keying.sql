-- Update replace_scheduled_session_overrides to key per (client, date, session_id).
--
-- Antes: SELECT por (client, date), UPDATE session_id en la fila
-- encontrada. Bajo el modelo nuevo (migration 113) puede haber N filas
-- por (client, date) — una por sesión tocada. Esa lógica:
--   1. Choca con la UNIQUE nueva si el trainer cambia su pin a una
--      sesión donde ya existe una fila prescribed_by='client'.
--   2. Deja stale trainer pins en sesiones distintas a la elegida,
--      creando "doble prescripción" para una misma fecha.
--
-- Comportamiento nuevo:
--   - Upsert la fila (client, date, p_session_id) con prescribed_by='trainer'.
--     Si la fila existía como 'client' (cliente entrenó esa sesión sin
--     prescripción previa), se flippea — el trainer ratifica.
--   - Reemplaza per-exercise overrides en la fila target.
--   - Reconcilia stale trainer pins en OTRAS session_ids del mismo
--     (client, date): si no tienen exercise_logs, DELETE; si tienen
--     logs, demote a 'client' (preserva actividad, deja de ser anchor
--     de prescripción). Los overrides per-exercise en esas filas se
--     dejan como snapshot histórico.

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

    -- Validación cruzada exerciseOrder p_sets vs p_exercises (igual que 110).
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

    -- Lock coarse-grained sobre (client, date) — el RPC toca múltiples
    -- filas potenciales (target + stale pins), conviene serializar todo
    -- el RPC para esa fecha.
    v_lock_key := hashtextextended(
        p_client_id::text || ':' || p_scheduled_date::text, 0
    );
    PERFORM pg_advisory_xact_lock(v_lock_key);

    -- 1. Upsert la fila target (client, date, p_session_id).
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

    -- 2. Reconciliar stale trainer pins en OTRAS session_ids para esta
    --    (client, date). Si no tienen logs: DELETE; si tienen logs:
    --    demote a 'client'.
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

    -- 3. Replace overrides en la fila target (DELETE + INSERT — idéntico
    --    al patrón de 110).
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
