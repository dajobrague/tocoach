-- Ingredients cache (P0-T7)
--
-- A tenant-scoped cache of foods resolved from a FoodSource (Open Food Facts
-- or manual entry). Stores the normalized per-100g nutrient set so repeated
-- lookups are local hits instead of network calls.
--
-- Tenant scoping and RLS mirror the existing app convention (see the
-- `exercises` table in the production baseline): a `tenant_host` FK to
-- tenants(host), permissive RLS policies for anon + authenticated, with
-- authorization enforced at the application layer.

-- =====================================================
-- TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS ingredients (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_host TEXT NOT NULL REFERENCES tenants(host) ON DELETE CASCADE,
    source TEXT NOT NULL CHECK (source IN ('off', 'manual')),
    source_ref TEXT,
    name TEXT NOT NULL,
    brand TEXT,
    default_unit TEXT NOT NULL DEFAULT 'g',
    -- Per-100g nutrients. Missing values are stored as 0, never null.
    kcal NUMERIC NOT NULL DEFAULT 0,
    protein_g NUMERIC NOT NULL DEFAULT 0,
    carbs_g NUMERIC NOT NULL DEFAULT 0,
    fat_g NUMERIC NOT NULL DEFAULT 0,
    sugar_g NUMERIC NOT NULL DEFAULT 0,
    fiber_g NUMERIC NOT NULL DEFAULT 0,
    sat_fat_g NUMERIC NOT NULL DEFAULT 0,
    sodium_mg NUMERIC NOT NULL DEFAULT 0,
    -- Reserved for future nutrients without a schema change.
    nutrient_extra JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ingredients_name_not_empty CHECK (name <> '')
);

-- =====================================================
-- INDEXES
-- =====================================================
-- Tenant scoping (matches the `<table>_tenant_idx` convention).
CREATE INDEX IF NOT EXISTS ingredients_tenant_idx ON ingredients (tenant_host);

-- Cache lookups by source + ref within a tenant.
CREATE INDEX IF NOT EXISTS ingredients_tenant_source_ref_idx
    ON ingredients (tenant_host, source, source_ref);

-- Name search. pg_trgm is not enabled in the baseline, so use a btree on
-- lower(name) for case-insensitive prefix/equality lookups.
CREATE INDEX IF NOT EXISTS ingredients_name_lower_idx
    ON ingredients (lower(name));

-- =====================================================
-- UPDATED_AT TRIGGER
-- =====================================================
CREATE TRIGGER update_ingredients_updated_at BEFORE UPDATE ON ingredients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================
ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;

-- Permissive policies mirroring `exercises`; the app verifies ownership via
-- tenant_host scoping. The anon role is used by middleware (anon key + RLS).
CREATE POLICY "Allow anon to manage ingredients" ON ingredients
    TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can manage ingredients" ON ingredients
    TO authenticated USING (true) WITH CHECK (true);

COMMENT ON POLICY "Authenticated users can manage ingredients" ON ingredients IS
    'Allows authenticated trainers to manage cached ingredients. Application verifies the trainer owns the data via tenant_host scoping.';

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON TABLE ingredients IS 'Tenant-scoped cache of foods resolved from a FoodSource (Open Food Facts or manual), normalized to per-100g nutrients.';
COMMENT ON COLUMN ingredients.source IS 'Originating FoodSource: off (Open Food Facts) or manual.';
COMMENT ON COLUMN ingredients.source_ref IS 'Source-scoped identifier (OFF product code); null for ad-hoc manual entries.';
COMMENT ON COLUMN ingredients.nutrient_extra IS 'Reserved for future nutrients without a schema change.';
