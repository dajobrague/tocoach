-- =====================================================
-- NAMED NUTRITION GOAL PRESETS + PER-DAY TARGETS
-- =====================================================
-- Trainers define named daily objectives per client ("Día de entrenamiento",
-- "Día de descanso", …) and assign one to each day of a meal plan. The day's
-- progress UI then measures against that objective instead of the client's
-- single default goal (client_nutrition_goals, which stays as the fallback).

-- 1) Named goal presets, per client. Mirrors client_nutrition_goals:
--    tenant_host FK + permissive RLS + app-layer tenant scoping.
CREATE TABLE IF NOT EXISTS client_goal_presets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_host TEXT NOT NULL REFERENCES tenants(host) ON DELETE CASCADE,
    client_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    kcal INTEGER NOT NULL,
    protein_g INTEGER NOT NULL,
    carbs_g INTEGER NOT NULL,
    fat_g INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_host, client_id, name)
);

CREATE INDEX IF NOT EXISTS client_goal_presets_client_idx
    ON client_goal_presets (tenant_host, client_id);

CREATE TRIGGER update_client_goal_presets_updated_at BEFORE UPDATE
    ON client_goal_presets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE client_goal_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon to manage client_goal_presets" ON client_goal_presets
    TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage client_goal_presets" ON client_goal_presets
    TO authenticated USING (true) WITH CHECK (true);

COMMENT ON TABLE client_goal_presets IS 'Named daily nutrition objectives per client (e.g. training day vs rest day). Assigned to plan days via meal_cycles.day_targets.';

-- 2) Per-day objective assignment on the plan itself: day_index → preset id.
--    JSONB (not a table) because days are implicit (duration_days + slot
--    day_index); the service remaps keys on remove/reorder/copy-day exactly
--    like it renumbers slots. No FK — a deleted preset simply falls back to
--    the client's default goals at read time.
ALTER TABLE meal_cycles
    ADD COLUMN IF NOT EXISTS day_targets JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN meal_cycles.day_targets IS 'Map of day_index (string) to client_goal_presets.id. Days without an entry use the client''s default nutrition goals.';
