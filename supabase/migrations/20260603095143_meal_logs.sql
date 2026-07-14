-- Meal logs (P5-T1) — the client's adherence log: what they actually ate.
--
-- One log per meal slot per day. status records whether they ate the planned
-- option, ate something else, or skipped; option_id (nullable) ties an
-- eaten_planned log to the chosen option. Conventions mirror the other
-- nutrition-v2 tables:
--   * tenant_host TEXT NOT NULL REFERENCES tenants(host) ON DELETE CASCADE
--   * permissive anon + authenticated RLS (authorization at the app layer:
--     a client can only log on a slot of their OWN active cycle — §4.4)
--   * update_updated_at_column() trigger; <table>_<col>_idx index naming
--
-- One log per (client_id, slot_id, log_date): a UNIQUE constraint so re-logging
-- the same meal/day upserts rather than accumulating rows.

CREATE TABLE IF NOT EXISTS meal_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_host TEXT NOT NULL REFERENCES tenants(host) ON DELETE CASCADE,
    client_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    slot_id UUID NOT NULL REFERENCES meal_slots(id) ON DELETE CASCADE,
    option_id UUID REFERENCES meal_slot_options(id) ON DELETE SET NULL,
    log_date DATE NOT NULL,
    status TEXT NOT NULL
        CHECK (status IN ('eaten_planned', 'eaten_other', 'skipped')),
    comment TEXT,
    photo_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT meal_logs_one_per_slot_per_day
        UNIQUE (client_id, slot_id, log_date)
);

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS meal_logs_tenant_idx ON meal_logs (tenant_host);
CREATE INDEX IF NOT EXISTS meal_logs_client_idx ON meal_logs (client_id);
CREATE INDEX IF NOT EXISTS meal_logs_slot_idx ON meal_logs (slot_id);
CREATE INDEX IF NOT EXISTS meal_logs_log_date_idx ON meal_logs (log_date);

-- =====================================================
-- UPDATED_AT TRIGGER
-- =====================================================
CREATE TRIGGER update_meal_logs_updated_at BEFORE UPDATE ON meal_logs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================
-- Permissive policies mirroring the other nutrition tables; the app verifies
-- ownership (the slot must belong to the authed client's active cycle).
ALTER TABLE meal_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon to manage meal_logs" ON meal_logs
    TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage meal_logs" ON meal_logs
    TO authenticated USING (true) WITH CHECK (true);

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON TABLE meal_logs IS 'A client''s meal-adherence log. One per (client_id, slot_id, log_date).';
COMMENT ON COLUMN meal_logs.status IS 'eaten_planned | eaten_other | skipped.';
COMMENT ON COLUMN meal_logs.option_id IS 'The option eaten (for eaten_planned); SET NULL if the option is later removed.';
