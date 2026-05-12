-- Hardening for replace_scheduled_session_overrides.
--
-- Migration 099 left a silent failure mode: if p_sets contained an
-- exerciseOrder that wasn't in p_exercises (e.g., concurrent editors,
-- malformed client payload), the JOIN dropped those per-set rows
-- without raising. The day saved successfully but with missing per-set
-- prescription — appears to the trainer as "guardé pero no se ven".
--
-- This migration redrops/recreates the function adding a defensive
-- check: every distinct exerciseOrder referenced by p_sets MUST exist
-- in p_exercises. Otherwise RAISE EXCEPTION rolls back the whole
-- transaction so the caller sees an error instead of partial state.
--
-- Same DROP/CREATE shape as 099 — keeps the UUID return.

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
    -- Cross-validate p_sets order references BEFORE touching anything.
    -- jsonb_array_elements is null-safe via jsonb_array_length guard.
    IF jsonb_array_length(p_sets) > 0 THEN
        SELECT array_agg(DISTINCT (e->>'exerciseOrder')::INT)
        INTO v_ex_orders
        FROM jsonb_array_elements(p_exercises) AS e;

        SELECT array_agg(DISTINCT (s->>'exerciseOrder')::INT)
        INTO v_set_orders
        FROM jsonb_array_elements(p_sets) AS s;

        -- Find set-orders that have no matching exercise-order.
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
