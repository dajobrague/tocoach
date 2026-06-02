-- Meal options: Plan → Days → Meals → Options → Ingredients
-- Each ingredient belongs to an option; options belong to meals.
-- Existing meals get one default "Opción 1" with macros and image copied from the meal.

-- =====================================================
-- TABLE: nutrition_meal_options
-- =====================================================
CREATE TABLE nutrition_meal_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meal_id UUID NOT NULL REFERENCES nutrition_meals (id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT 'Opción 1',
    option_order INTEGER NOT NULL DEFAULT 1,
    protein DECIMAL(10, 2),
    carbs DECIMAL(10, 2),
    fats DECIMAL(10, 2),
    calories DECIMAL(10, 2),
    image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE nutrition_meal_options IS 'Alternatives within a meal (e.g. Opción 1 / Opción 2). Ingredients attach to an option. Hierarchy: plan → days → meals → options → ingredients.';

-- =====================================================
-- INGREDIENTS: option_id (nullable until backfill)
-- =====================================================
ALTER TABLE nutrition_ingredients
ADD COLUMN option_id UUID;

-- =====================================================
-- DATA: one default option per meal; wire ingredients
-- =====================================================
INSERT INTO nutrition_meal_options (meal_id, name, option_order, protein, carbs, fats, calories, image_url)
SELECT
    m.id,
    'Opción 1',
    1,
    m.protein,
    m.carbs,
    m.fats,
    m.calories,
    m.image_url
FROM nutrition_meals m
WHERE NOT EXISTS (
        SELECT 1
        FROM nutrition_meal_options o
        WHERE
            o.meal_id = m.id
    );

UPDATE nutrition_ingredients i
SET
    option_id = o.id
FROM nutrition_meal_options o
WHERE
    o.meal_id = i.nutrition_meal_id;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM nutrition_ingredients
        WHERE
            option_id IS NULL
    ) THEN
        RAISE EXCEPTION 'migration 073: nutrition_ingredients.option_id must be set for all rows';
    END IF;
END
$$;

-- =====================================================
-- ENFORCE option_id
-- =====================================================
ALTER TABLE nutrition_ingredients ALTER COLUMN option_id SET NOT NULL;

ALTER TABLE nutrition_ingredients ADD CONSTRAINT fk_ingredient_option FOREIGN KEY (option_id) REFERENCES nutrition_meal_options (id) ON DELETE CASCADE;

COMMENT ON COLUMN nutrition_ingredients.nutrition_meal_id IS 'Denormalized meal reference for simpler queries; canonical parent is nutrition_meal_options.meal_id via option_id.';

-- =====================================================
-- MEALS: quick flag for multiple options
-- =====================================================
ALTER TABLE nutrition_meals
ADD COLUMN has_alternatives BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN nutrition_meals.has_alternatives IS 'True when this meal has more than one nutrition_meal_options row; avoids counting options on every read.';

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX nutrition_meal_options_meal_id_idx ON nutrition_meal_options (meal_id);

CREATE INDEX nutrition_ingredients_option_id_idx ON nutrition_ingredients (option_id);

-- =====================================================
-- updated_at trigger
-- =====================================================
CREATE TRIGGER update_nutrition_meal_options_updated_at BEFORE UPDATE ON nutrition_meal_options FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- RLS (anon + authenticated; authorization at API layer)
-- =====================================================
ALTER TABLE nutrition_meal_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trainers can manage nutrition meal options" ON nutrition_meal_options FOR ALL TO anon,
authenticated USING (true)
WITH
    CHECK (true);

COMMENT ON POLICY "Trainers can manage nutrition meal options" ON nutrition_meal_options IS 'Permissive access for API routes using anon or Supabase auth; authorization enforced in application layer.';
