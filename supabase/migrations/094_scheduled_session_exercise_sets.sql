-- Per-set granularity for scheduled session overrides.
--
-- The parent table scheduled_session_exercises (migration 093) already
-- carries a "uniform" prescription: sets count + uniform reps + uniform
-- weight_kg. That covers ~90% of trainer flows ("4×8 @ 60kg").
--
-- This child table lets the trainer prescribe each set individually for
-- pyramids, drop sets, or RPE-driven progressions:
--   Set 1: 8 reps × 60 kg
--   Set 2: 8 reps × 60 kg
--   Set 3: 6 reps × 65 kg
--   Set 4: 4 reps × 70 kg
--
-- Read precedence inside a single override exercise:
--   if scheduled_session_exercise_sets rows exist → per-set is the truth
--   else → use the parent's uniform sets/reps/weight_kg
--
-- Mirrors the symmetry exercise_logs ↔ exercise_log_sets so the read
-- pipeline is the same on both sides (prescribed vs executed).

CREATE TABLE IF NOT EXISTS scheduled_session_exercise_sets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_host TEXT NOT NULL REFERENCES tenants(host) ON DELETE CASCADE,
    scheduled_session_exercise_id UUID NOT NULL REFERENCES scheduled_session_exercises(id) ON DELETE CASCADE,
    set_number INTEGER NOT NULL,
    reps TEXT,                  -- "10-12", "AMRAP", or numeric as string
    weight_kg DECIMAL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_sse_set_number
        UNIQUE (scheduled_session_exercise_id, set_number)
);

CREATE INDEX IF NOT EXISTS idx_scheduled_session_exercise_sets_parent
    ON scheduled_session_exercise_sets(scheduled_session_exercise_id);

ALTER TABLE scheduled_session_exercise_sets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon to manage scheduled session exercise sets"
    ON scheduled_session_exercise_sets FOR ALL TO anon USING (true) WITH CHECK (true);
