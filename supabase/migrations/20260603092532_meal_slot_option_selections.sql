-- Meal slot option selections (P4-T4) — the client's standing choice per meal.
--
-- A client picks ONE option per meal slot of their active cycle; the choice is
-- persisted and reflected in the today view. Conventions mirror the other
-- nutrition-v2 tables (meal_cycles et al.):
--   * tenant_host TEXT NOT NULL REFERENCES tenants(host) ON DELETE CASCADE
--   * permissive anon + authenticated RLS (authorization at the app layer:
--     a client can only select on a slot of their OWN active cycle — §4.4)
--   * update_updated_at_column() trigger; <table>_<col>_idx index naming
--
-- One standing choice per (client_id, slot_id): a UNIQUE constraint so changing
-- the pick upserts rather than accumulating rows.

CREATE TABLE IF NOT EXISTS meal_slot_option_selections (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_host TEXT NOT NULL REFERENCES tenants(host) ON DELETE CASCADE,
    client_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    slot_id UUID NOT NULL REFERENCES meal_slots(id) ON DELETE CASCADE,
    option_id UUID NOT NULL REFERENCES meal_slot_options(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT meal_slot_option_selections_one_per_slot
        UNIQUE (client_id, slot_id)
);

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS meal_slot_option_selections_tenant_idx
    ON meal_slot_option_selections (tenant_host);
CREATE INDEX IF NOT EXISTS meal_slot_option_selections_client_idx
    ON meal_slot_option_selections (client_id);
CREATE INDEX IF NOT EXISTS meal_slot_option_selections_slot_idx
    ON meal_slot_option_selections (slot_id);

-- =====================================================
-- UPDATED_AT TRIGGER
-- =====================================================
CREATE TRIGGER update_meal_slot_option_selections_updated_at BEFORE UPDATE
    ON meal_slot_option_selections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================
-- Permissive policies mirroring the other nutrition tables; the app verifies
-- ownership (the slot must belong to the authed client's active cycle).
ALTER TABLE meal_slot_option_selections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon to manage meal_slot_option_selections"
    ON meal_slot_option_selections
    TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage meal_slot_option_selections"
    ON meal_slot_option_selections
    TO authenticated USING (true) WITH CHECK (true);

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON TABLE meal_slot_option_selections IS 'A client''s standing option choice for a meal slot. One per (client_id, slot_id).';
COMMENT ON COLUMN meal_slot_option_selections.slot_id IS 'The chosen slot; must belong to the client''s own active cycle (enforced at the app layer, §4.4).';
