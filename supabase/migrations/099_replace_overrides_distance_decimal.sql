-- Fix for migration 098. The RPC casted distance_meters to INT inside
-- the JSONB insert path:
--     NULLIF(e->>'distanceMeters', '')::INT
-- but the column is DECIMAL. As a result, fractional override distances
-- (e.g. 5.5 km = 5500.5 m) were silently truncated to 5500. Also affects
-- any future API change that lets the trainer prescribe fractional
-- meters.
--
-- Same DROP/CREATE pattern as 098 — return type is unchanged (UUID), so
-- the drop is purely defensive in case the function signature ever
-- shifts. We re-grant EXECUTE at the end.

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
BEGIN
    v_lock_key := hashtextextended(
        p_client_id::text || ':' || p_scheduled_date::text, 0
    );
    PERFORM pg_advisory_xact_lock(v_lock_key);

    SELECT id INTO v_scheduled_session_id
    FROM scheduled_sessions
    WHERE client_id = p_client_id AND scheduled_date = p_scheduled_date
    FOR UPDATE;

    IF v_scheduled_session_id IS NULL THEN
        INSERT INTO scheduled_sessions(
            tenant_host, client_id, trainer_id, session_id,
            scheduled_date, status
        )
        VALUES (
            p_tenant_host, p_client_id, p_trainer_id, p_session_id,
            p_scheduled_date, 'scheduled'
        )
        RETURNING id INTO v_scheduled_session_id;
    ELSE
        UPDATE scheduled_sessions
        SET session_id = p_session_id,
            status = 'scheduled',
            updated_at = NOW()
        WHERE id = v_scheduled_session_id;
    END IF;

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
            -- FIX 099: distance_meters es DECIMAL en la tabla. Antes se
            -- casteaba a INT y truncaba fracciones de metro.
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
