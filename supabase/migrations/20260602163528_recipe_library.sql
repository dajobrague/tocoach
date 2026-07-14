-- Recipe library (P1-T1)
--
-- A trainer-authored recipe library: recipes, their ingredient lines, and
-- their media. Tenant scoping, ownership, RLS, and triggers mirror the
-- established convention (see the `exercises` and `ingredients` tables):
--   * tenant_host TEXT NOT NULL REFERENCES tenants(host) ON DELETE CASCADE
--   * trainer_id  UUID NOT NULL REFERENCES trainers(id)  ON DELETE CASCADE
--   * permissive anon + authenticated RLS (authorization at the app layer)
--   * update_updated_at_column() trigger; <table>_tenant_idx index naming
--
-- One recipe = one serving; the denormalized nutrient totals are per serving.

-- =====================================================
-- RECIPES
-- =====================================================
CREATE TABLE IF NOT EXISTS recipes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_host TEXT NOT NULL REFERENCES tenants(host) ON DELETE CASCADE,
    trainer_id UUID NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    instructions TEXT,
    prep_time_min INTEGER,
    cook_time_min INTEGER,
    meal_type_tags TEXT[] NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'active', 'archived')),
    -- Denormalized per-serving nutrient totals. Default 0, never null.
    kcal NUMERIC NOT NULL DEFAULT 0,
    protein_g NUMERIC NOT NULL DEFAULT 0,
    carbs_g NUMERIC NOT NULL DEFAULT 0,
    fat_g NUMERIC NOT NULL DEFAULT 0,
    sugar_g NUMERIC NOT NULL DEFAULT 0,
    fiber_g NUMERIC NOT NULL DEFAULT 0,
    sat_fat_g NUMERIC NOT NULL DEFAULT 0,
    sodium_mg NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT recipes_name_not_empty CHECK (name <> '')
);

-- =====================================================
-- RECIPE INGREDIENTS
-- =====================================================
-- One line per ingredient. ingredient_id is nullable so free-text lines are
-- allowed; name_snapshot/nutrient_snapshot freeze the values at add time so
-- editing the cached ingredient never mutates an existing recipe.
CREATE TABLE IF NOT EXISTS recipe_ingredients (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    ingredient_id UUID REFERENCES ingredients(id),
    name_snapshot TEXT NOT NULL,
    quantity NUMERIC NOT NULL,
    unit TEXT NOT NULL DEFAULT 'g',
    -- Per-100g nutrient values frozen when the line was added.
    nutrient_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- RECIPE MEDIA
-- =====================================================
CREATE TABLE IF NOT EXISTS recipe_media (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('image', 'video')),
    url TEXT NOT NULL,
    orientation TEXT CHECK (orientation IN ('vertical', 'horizontal')),
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS recipes_tenant_idx ON recipes (tenant_host);
CREATE INDEX IF NOT EXISTS recipes_trainer_idx ON recipes (trainer_id);
CREATE INDEX IF NOT EXISTS recipes_tenant_status_idx
    ON recipes (tenant_host, status);
-- GIN over the tag array for meal-type filtering (e.g. tags @> ARRAY['lunch']).
CREATE INDEX IF NOT EXISTS recipes_meal_type_tags_gin_idx
    ON recipes USING gin (meal_type_tags);

CREATE INDEX IF NOT EXISTS recipe_ingredients_recipe_idx
    ON recipe_ingredients (recipe_id);

CREATE INDEX IF NOT EXISTS recipe_media_recipe_idx
    ON recipe_media (recipe_id);

-- =====================================================
-- UPDATED_AT TRIGGER (recipes only; children are append-only)
-- =====================================================
CREATE TRIGGER update_recipes_updated_at BEFORE UPDATE ON recipes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================
-- Permissive policies mirroring `exercises`/`ingredients`; the app verifies
-- ownership (recipes via tenant_host, children via their parent recipe). The
-- anon role is used by middleware (anon key + RLS).
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon to manage recipes" ON recipes
    TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage recipes" ON recipes
    TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow anon to manage recipe_ingredients" ON recipe_ingredients
    TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage recipe_ingredients" ON recipe_ingredients
    TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow anon to manage recipe_media" ON recipe_media
    TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage recipe_media" ON recipe_media
    TO authenticated USING (true) WITH CHECK (true);

COMMENT ON POLICY "Authenticated users can manage recipes" ON recipes IS
    'Allows authenticated trainers to manage recipes. Application verifies ownership via tenant_host scoping.';

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON TABLE recipes IS 'Trainer-authored recipe library. One recipe = one serving; nutrient columns are per-serving totals.';
COMMENT ON TABLE recipe_ingredients IS 'Ingredient lines for a recipe; name/nutrient snapshots freeze values at add time.';
COMMENT ON TABLE recipe_media IS 'Media (image or video) attached to a recipe.';
COMMENT ON COLUMN recipe_ingredients.ingredient_id IS 'Optional link to the ingredients cache; null for free-text lines.';
COMMENT ON COLUMN recipe_ingredients.nutrient_snapshot IS 'Per-100g nutrient values frozen at add time.';
