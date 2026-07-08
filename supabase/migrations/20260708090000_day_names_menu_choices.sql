-- =====================================================
-- NAMED PLAN DAYS (MENUS) + CLIENT MENU CHOICE PER DATE
-- =====================================================
-- Traineeks-style model (nutrition v3 phase 1): plan days become named menús
-- ("Día de entreno", "Día de oficina", …) and the date rotation becomes a
-- RECOMMENDATION — each day the client may pick which menú to follow, exactly
-- like choosing a training session. Resolution: client's choice ?? rotation.

-- 1) Day names on the plan, keyed by day_index (JSONB like day_targets; days
--    are implicit, so the service remaps keys on remove/reorder/copy-day).
ALTER TABLE meal_cycles
    ADD COLUMN IF NOT EXISTS day_names JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN meal_cycles.day_names IS 'Map of day_index (string) to the menu''s display name ("Día de entreno"). Unnamed days render as "Día N".';

-- 2) The client's menu choice per calendar date. One row per (client, date);
--    absent = follow the rotation's recommended day. cycle_id is recorded so a
--    choice never leaks across plans (resolution ignores rows from other
--    cycles). Permissive RLS + app-layer scoping, like the other v2 tables.
CREATE TABLE IF NOT EXISTS client_menu_choices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_host TEXT NOT NULL REFERENCES tenants(host) ON DELETE CASCADE,
    client_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    cycle_id UUID NOT NULL REFERENCES meal_cycles(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    day_index INTEGER NOT NULL CHECK (day_index >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_host, client_id, date)
);

CREATE INDEX IF NOT EXISTS client_menu_choices_client_date_idx
    ON client_menu_choices (tenant_host, client_id, date);

CREATE TRIGGER update_client_menu_choices_updated_at BEFORE UPDATE
    ON client_menu_choices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE client_menu_choices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon to manage client_menu_choices" ON client_menu_choices
    TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage client_menu_choices" ON client_menu_choices
    TO authenticated USING (true) WITH CHECK (true);

COMMENT ON TABLE client_menu_choices IS 'Which plan menu (day_index) the client chose to follow on a calendar date. Absent = the rotation''s recommended day.';
