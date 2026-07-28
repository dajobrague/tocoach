-- =====================================================
-- PER-CLIENT NUTRITION VISIBILITY (nutrition-v2 delivery)
-- =====================================================
-- Which nutrition sections the client's Nutrición page shows, chosen by the
-- trainer: any combination of 'plan' (active meal plan), 'pdf' (diet PDF) and
-- 'goals' (macro objectives). NO row means "Automático" — the original
-- delivery ladder (plan → PDF → goals-only → empty) keeps deciding, so this
-- table needs no backfill and existing clients see no change until their
-- trainer picks something. Sections without data are ignored at read time
-- (resolution intersects with availability and falls back to the ladder), so
-- a stale choice can never blank the client's page.
-- Mirrors client_diet_pdfs conventions: tenant_host FK + permissive RLS +
-- app-layer tenant scoping.
CREATE TABLE IF NOT EXISTS client_nutrition_visibility (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_host TEXT NOT NULL REFERENCES tenants(host) ON DELETE CASCADE,
    client_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    sections TEXT [] NOT NULL CHECK (
        array_length(sections, 1) >= 1
        AND sections <@ ARRAY ['plan', 'pdf', 'goals']
    ),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_host, client_id)
);

DROP TRIGGER IF EXISTS update_client_nutrition_visibility_updated_at ON client_nutrition_visibility;
CREATE TRIGGER update_client_nutrition_visibility_updated_at BEFORE UPDATE
    ON client_nutrition_visibility
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE client_nutrition_visibility ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon to manage client_nutrition_visibility" ON client_nutrition_visibility;
DROP POLICY IF EXISTS "Authenticated users can manage client_nutrition_visibility" ON client_nutrition_visibility;

CREATE POLICY "Allow anon to manage client_nutrition_visibility" ON client_nutrition_visibility
    TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage client_nutrition_visibility" ON client_nutrition_visibility
    TO authenticated USING (true) WITH CHECK (true);

COMMENT ON TABLE client_nutrition_visibility IS 'Trainer-chosen nutrition sections the client sees (plan/pdf/goals). No row = automatic delivery ladder.';
