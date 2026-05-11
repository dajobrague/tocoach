-- Per-date override of a scheduled session's prescription.
--
-- The microcycle template (microcycles + microcycle_slots → sessions →
-- session_exercises) defines the recurring weekly pattern. When the trainer
-- needs to deviate for a single date — change the assigned session, tweak
-- sets/reps/weight, add or remove an exercise — they save a row per
-- exercise here. Read precedence: override → session_exercises →
-- microcycle template.
--
-- Every Save in the editor is a delete + full insert: this table always
-- represents the complete plan for the day when present, never partial
-- diffs. That invariant keeps the read logic trivial.

CREATE TABLE IF NOT EXISTS scheduled_session_exercises (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_host TEXT NOT NULL REFERENCES tenants(host) ON DELETE CASCADE,
    scheduled_session_id UUID NOT NULL REFERENCES scheduled_sessions(id) ON DELETE CASCADE,
    exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
    exercise_order INTEGER NOT NULL,
    sets INTEGER,
    reps TEXT,                          -- "10-12", "AMRAP", etc.
    weight_kg DECIMAL,
    duration_seconds INTEGER,
    distance_meters DECIMAL,
    rest_seconds INTEGER,
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_scheduled_session_exercise_order
        UNIQUE (scheduled_session_id, exercise_order)
);

CREATE INDEX IF NOT EXISTS idx_scheduled_session_exercises_session
    ON scheduled_session_exercises(scheduled_session_id);

ALTER TABLE scheduled_session_exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon to manage scheduled session exercises"
    ON scheduled_session_exercises FOR ALL TO anon USING (true) WITH CHECK (true);
