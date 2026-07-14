-- Meal cycles (P3-T1) — the cycle-assignment core.
--
-- A trainer assigns a client a multi-day "cycle" of meal slots; each slot holds
-- one or more options (a recipe or a raw food). The option carries a frozen
-- `item_snapshot` (see P3-T2) so the client view never joins back to the
-- mutable library. Conventions mirror the recipe_library tables:
--   * tenant_host TEXT NOT NULL REFERENCES tenants(host) ON DELETE CASCADE
--   * permissive anon + authenticated RLS (authorization at the app layer)
--   * update_updated_at_column() trigger; <table>_<col>_idx index naming

-- =====================================================
-- MEAL CYCLES
-- =====================================================
CREATE TABLE IF NOT EXISTS meal_cycles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_host TEXT NOT NULL REFERENCES tenants(host) ON DELETE CASCADE,
    trainer_id UUID NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
    client_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    duration_days INTEGER NOT NULL CHECK (duration_days > 0),
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'active', 'archived')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT meal_cycles_name_not_empty CHECK (name <> '')
);

-- =====================================================
-- MEAL SLOTS
-- =====================================================
-- day_index runs 0..(meal_cycles.duration_days - 1); the upper bound depends on
-- the parent cycle so it is enforced at the app layer, not by a CHECK.
CREATE TABLE IF NOT EXISTS meal_slots (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    cycle_id UUID NOT NULL REFERENCES meal_cycles(id) ON DELETE CASCADE,
    tenant_host TEXT NOT NULL REFERENCES tenants(host) ON DELETE CASCADE,
    day_index INTEGER NOT NULL CHECK (day_index >= 0),
    label TEXT NOT NULL DEFAULT '',
    position INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- MEAL SLOT OPTIONS
-- =====================================================
-- source_ref_id points at a recipe or ingredient id but is intentionally NOT a
-- foreign key: item_snapshot is a self-contained freeze (§4.1) that must survive
-- the source recipe/food being edited or deleted in the library.
CREATE TABLE IF NOT EXISTS meal_slot_options (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    slot_id UUID NOT NULL REFERENCES meal_slots(id) ON DELETE CASCADE,
    tenant_host TEXT NOT NULL REFERENCES tenants(host) ON DELETE CASCADE,
    source_type TEXT NOT NULL CHECK (source_type IN ('recipe', 'food')),
    source_ref_id UUID NOT NULL,
    item_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS meal_cycles_tenant_idx
    ON meal_cycles (tenant_host);
CREATE INDEX IF NOT EXISTS meal_cycles_client_idx
    ON meal_cycles (client_id);
-- At most one ACTIVE cycle per client (partial unique).
CREATE UNIQUE INDEX IF NOT EXISTS meal_cycles_one_active_per_client_idx
    ON meal_cycles (tenant_host, client_id)
    WHERE status = 'active';

CREATE INDEX IF NOT EXISTS meal_slots_tenant_idx
    ON meal_slots (tenant_host);
CREATE INDEX IF NOT EXISTS meal_slots_cycle_idx
    ON meal_slots (cycle_id);

CREATE INDEX IF NOT EXISTS meal_slot_options_tenant_idx
    ON meal_slot_options (tenant_host);
CREATE INDEX IF NOT EXISTS meal_slot_options_slot_idx
    ON meal_slot_options (slot_id);

-- =====================================================
-- UPDATED_AT TRIGGERS
-- =====================================================
CREATE TRIGGER update_meal_cycles_updated_at BEFORE UPDATE ON meal_cycles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_meal_slots_updated_at BEFORE UPDATE ON meal_slots
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_meal_slot_options_updated_at BEFORE UPDATE
    ON meal_slot_options
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================
-- Permissive policies mirroring recipes/ingredients; the app verifies ownership
-- via tenant_host scoping. The anon role is used by middleware (anon key + RLS).
ALTER TABLE meal_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_slot_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon to manage meal_cycles" ON meal_cycles
    TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage meal_cycles" ON meal_cycles
    TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow anon to manage meal_slots" ON meal_slots
    TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage meal_slots" ON meal_slots
    TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow anon to manage meal_slot_options" ON meal_slot_options
    TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage meal_slot_options" ON meal_slot_options
    TO authenticated USING (true) WITH CHECK (true);

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON TABLE meal_cycles IS 'A client''s multi-day meal cycle. At most one active cycle per (tenant_host, client_id).';
COMMENT ON TABLE meal_slots IS 'A labelled slot on a given day_index (0..duration-1) of a meal cycle.';
COMMENT ON TABLE meal_slot_options IS 'A recipe/food option in a slot; item_snapshot is a self-contained freeze (§4.1).';
COMMENT ON COLUMN meal_slot_options.source_ref_id IS 'Originating recipe/ingredient id; NOT an FK — the snapshot is decoupled from the mutable library.';
COMMENT ON COLUMN meal_slot_options.item_snapshot IS 'Frozen render payload (name, steps, images, ingredients, rolled-up totals).';
