-- Meal cycle overrides (P7-T1) — trainer ad-hoc tweaks on top of a cycle.
--
-- A trainer can attach, for a client's cycle, either a NOTE (free text on a
-- date, or on a specific slot of that date) or a SWAP (replace a slot's options
-- with a frozen recipe/food). Each override has a SCOPE that decides which
-- dates it applies to:
--   * single_day  — only on anchor_date
--   * day_forward — on anchor_date and every date after it
--   * every_cycle — on every rotation day whose day_index matches (cycle-repeat)
--
-- A swap freezes swap_snapshot via buildOptionSnapshot at write time, so a later
-- edit of the swapped-in recipe never alters the override (§4.1 guarantee) —
-- same decoupling as meal_slot_options.item_snapshot. Conventions mirror the
-- other nutrition-v2 tables (tenant_host FK + permissive RLS + app-layer
-- scoping; update_updated_at_column() trigger; <table>_<col>_idx indexes).

CREATE TABLE IF NOT EXISTS meal_cycle_overrides (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_host TEXT NOT NULL REFERENCES tenants(host) ON DELETE CASCADE,
    cycle_id UUID NOT NULL REFERENCES meal_cycles(id) ON DELETE CASCADE,
    client_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    override_type TEXT NOT NULL CHECK (override_type IN ('note', 'swap')),
    scope TEXT NOT NULL
        CHECK (scope IN ('single_day', 'day_forward', 'every_cycle')),
    anchor_date DATE NOT NULL,
    -- Only meaningful for scope = 'every_cycle' (which rotation day it repeats on).
    day_index INTEGER CHECK (day_index IS NULL OR day_index >= 0),
    -- NULL for a date-level note; required for a swap (the slot it replaces).
    slot_id UUID REFERENCES meal_slots(id) ON DELETE CASCADE,
    note_text TEXT,
    -- Swap freeze: source provenance (NOT an FK — the snapshot is decoupled) +
    -- the frozen render payload.
    swap_source_type TEXT CHECK (swap_source_type IN ('recipe', 'food')),
    swap_source_ref_id UUID,
    swap_snapshot JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- every_cycle repeats by day_index, so it must carry one.
    CONSTRAINT meal_cycle_overrides_every_cycle_day_index CHECK (
        scope <> 'every_cycle' OR day_index IS NOT NULL
    ),
    -- A note needs text; a swap needs a target slot + a frozen source.
    CONSTRAINT meal_cycle_overrides_shape CHECK (
        (override_type = 'note' AND note_text IS NOT NULL)
        OR (
            override_type = 'swap'
            AND slot_id IS NOT NULL
            AND swap_source_type IS NOT NULL
            AND swap_source_ref_id IS NOT NULL
            AND swap_snapshot IS NOT NULL
        )
    )
);

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS meal_cycle_overrides_tenant_idx
    ON meal_cycle_overrides (tenant_host);
CREATE INDEX IF NOT EXISTS meal_cycle_overrides_cycle_idx
    ON meal_cycle_overrides (cycle_id);
CREATE INDEX IF NOT EXISTS meal_cycle_overrides_client_idx
    ON meal_cycle_overrides (client_id);
CREATE INDEX IF NOT EXISTS meal_cycle_overrides_anchor_date_idx
    ON meal_cycle_overrides (anchor_date);

-- =====================================================
-- UPDATED_AT TRIGGER
-- =====================================================
CREATE TRIGGER update_meal_cycle_overrides_updated_at BEFORE UPDATE
    ON meal_cycle_overrides
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================
-- Permissive policies mirroring the other nutrition tables; authorization is at
-- the app layer (a trainer may only touch overrides on a cycle whose client
-- they own — clients.tenant = trainer id).
ALTER TABLE meal_cycle_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon to manage meal_cycle_overrides" ON meal_cycle_overrides
    TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage meal_cycle_overrides"
    ON meal_cycle_overrides
    TO authenticated USING (true) WITH CHECK (true);

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON TABLE meal_cycle_overrides IS 'Trainer ad-hoc notes/swaps layered on a client cycle, resolved per date by scope precedence.';
COMMENT ON COLUMN meal_cycle_overrides.scope IS 'single_day (anchor_date only) | day_forward (anchor_date onward) | every_cycle (by day_index).';
COMMENT ON COLUMN meal_cycle_overrides.day_index IS 'Rotation day this repeats on; required for every_cycle, NULL otherwise.';
COMMENT ON COLUMN meal_cycle_overrides.swap_snapshot IS 'Frozen recipe/food render payload (buildOptionSnapshot) — decoupled from the mutable library (§4.1).';
