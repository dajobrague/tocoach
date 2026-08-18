-- Shared recipe gallery (Jul 28 call, Javi; copy-install model chosen with
-- Jose). Sharing FREEZES the recipe (ingredients + media + macros) into this
-- global catalog table; importing copies the frozen payload into the target
-- tenant's own library. Tenant tables are never read across tenants — this
-- table is the only global surface, by design. Unsharing deletes the catalog
-- row; already-imported copies are standalone and survive.

CREATE TABLE IF NOT EXISTS community_recipes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_tenant_host TEXT NOT NULL,
    source_recipe_id UUID NOT NULL,
    -- Attribution captured at share time (tenant display name).
    shared_by TEXT,
    name TEXT NOT NULL,
    description TEXT,
    instructions TEXT,
    prep_time_min INTEGER,
    cook_time_min INTEGER,
    meal_type_tags TEXT[] NOT NULL DEFAULT '{}',
    kcal NUMERIC NOT NULL DEFAULT 0,
    protein_g NUMERIC NOT NULL DEFAULT 0,
    carbs_g NUMERIC NOT NULL DEFAULT 0,
    fat_g NUMERIC NOT NULL DEFAULT 0,
    sugar_g NUMERIC NOT NULL DEFAULT 0,
    fiber_g NUMERIC NOT NULL DEFAULT 0,
    sat_fat_g NUMERIC NOT NULL DEFAULT 0,
    sodium_mg NUMERIC NOT NULL DEFAULT 0,
    -- Frozen recipe_ingredients rows (name_snapshot, brand, quantity, unit,
    -- grams_per_unit, nutrient_snapshot, image_url, sort_order).
    ingredients JSONB NOT NULL DEFAULT '[]',
    -- Frozen recipe_media rows (type, url, orientation, sort_order).
    media JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One live share per source recipe; re-sharing refreshes the frozen payload.
CREATE UNIQUE INDEX IF NOT EXISTS community_recipes_source_idx
    ON community_recipes (source_tenant_host, source_recipe_id);
CREATE INDEX IF NOT EXISTS community_recipes_updated_idx
    ON community_recipes (updated_at DESC);
CREATE INDEX IF NOT EXISTS community_recipes_tags_gin_idx
    ON community_recipes USING gin (meal_type_tags);

ALTER TABLE community_recipes ENABLE ROW LEVEL SECURITY;

-- Globally readable by design (it IS the community catalog); writes are
-- app-layer scoped to the sharer's own source_tenant_host in the service.
CREATE POLICY "Allow anon to manage community_recipes" ON community_recipes
    TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage community_recipes" ON community_recipes
    TO authenticated USING (true) WITH CHECK (true);
