-- Fix for migration 095. The RPC declared
--   RETURNS TABLE(scheduled_session_id UUID)
-- which makes `scheduled_session_id` an implicit OUT variable in the
-- function body, ambiguous with the same-named column on
-- `scheduled_session_exercises` (the DELETE/INSERT targets). Postgres
-- raises "column reference scheduled_session_id is ambiguous" on the
-- DELETE step.
--
-- Simplest fix: return a scalar UUID instead of a single-column table.
-- Changing return type requires DROP + CREATE.

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
            NULLIF(e->>'distanceMeters', '')::INT,
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
