-- =====================================================
-- CLIENT NUTRITION GOALS
-- =====================================================
-- Per-client daily nutrition targets (kcal + macros). One row per
-- (tenant_host, client_id). Drives the meal-plan progress bars and the day
-- nutrition panel; the app falls back to built-in defaults when a client has no
-- row yet. Mirrors the other nutrition-v2 tables: tenant_host FK + permissive
-- RLS + app-layer tenant scoping.

CREATE TABLE IF NOT EXISTS client_nutrition_goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_host TEXT NOT NULL REFERENCES tenants(host) ON DELETE CASCADE,
    client_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    kcal INTEGER NOT NULL,
    protein_g INTEGER NOT NULL,
    carbs_g INTEGER NOT NULL,
    fat_g INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_host, client_id)
);

CREATE INDEX IF NOT EXISTS client_nutrition_goals_tenant_idx
    ON client_nutrition_goals (tenant_host);

CREATE TRIGGER update_client_nutrition_goals_updated_at BEFORE UPDATE
    ON client_nutrition_goals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================
-- Permissive policies mirroring the other nutrition-v2 tables; the app verifies
-- ownership via tenant_host scoping. The anon role is used by middleware.
ALTER TABLE client_nutrition_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon to manage client_nutrition_goals" ON client_nutrition_goals
    TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage client_nutrition_goals" ON client_nutrition_goals
    TO authenticated USING (true) WITH CHECK (true);

COMMENT ON TABLE client_nutrition_goals IS 'A client''s daily nutrition targets (kcal + macros). One row per (tenant_host, client_id).';
