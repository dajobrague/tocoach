-- Transactional RPC for trainer day-override PUT.
--
-- The previous /api/clients/[clientId]/scheduled-sessions/trainer/day PUT
-- did: upsert scheduled_sessions → DELETE children → INSERT children → INSERT
-- per-set children, across separate round-trips with no transaction and no
-- row lock. Two failure modes that this RPC closes:
--
-- 1. Partial write on error. If the per-set INSERT failed, the parent override
--    rows had already been written, leaving an inconsistent state that the
--    client read pipeline would treat as "override wins precedence".
--
-- 2. Concurrent PUTs for the same (client_id, scheduled_date). Two requests
--    could both pass the upsert check and produce duplicated/intermixed
--    exercise_order rows; the UNIQUE on (scheduled_session_id, exercise_order)
--    would reject some of the second batch silently, leaving a partial save.
--
-- Both are fixed by running the whole operation inside one function (atomic
-- in Postgres) and taking a transaction-scoped advisory lock keyed by
-- (client_id, scheduled_date).
--
-- Payload shape (JSONB):
--
-- p_exercises =
--   [ { exerciseId, exerciseOrder, sets, reps, weightKg,
--       durationSeconds, distanceMeters, restSeconds, notes }, ... ]
--
-- p_sets =
--   [ { exerciseOrder, setNumber, reps, weightKg }, ... ]
--
-- exerciseOrder is reused to link the per-set rows to the parent we just
-- inserted; the route validator guarantees uniqueness of exerciseOrder
-- within p_exercises.

CREATE OR REPLACE FUNCTION replace_scheduled_session_overrides(
    p_tenant_host TEXT,
    p_client_id BIGINT,
    p_trainer_id UUID,
    p_scheduled_date DATE,
    p_session_id UUID,
    p_exercises JSONB,
    p_sets JSONB
)
RETURNS TABLE(scheduled_session_id UUID)
LANGUAGE plpgsql
AS $$
DECLARE
    v_scheduled_session_id UUID;
    v_lock_key BIGINT;
BEGIN
    -- Per (client_id, scheduled_date) advisory lock. Released at the end
    -- of the implicit transaction wrapping this function.
    v_lock_key := hashtextextended(
        p_client_id::text || ':' || p_scheduled_date::text, 0
    );
    PERFORM pg_advisory_xact_lock(v_lock_key);

    -- Upsert scheduled_sessions row.
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

    -- Replace overrides. Cascade FK on scheduled_session_exercise_sets
    -- handles per-set cleanup.
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

    RETURN QUERY SELECT v_scheduled_session_id;
END;
$$;

GRANT EXECUTE ON FUNCTION replace_scheduled_session_overrides(
    TEXT, BIGINT, UUID, DATE, UUID, JSONB, JSONB
) TO anon, authenticated;
