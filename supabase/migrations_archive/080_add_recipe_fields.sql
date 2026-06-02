-- Migración 080: Sección "receta" en nutrition_meal_options (Item 2.4).
--
-- Contexto: feedback del trainer Carlos — quiere poder incluir
-- instrucciones de preparación, tiempos de cocción, porciones y notas
-- específicas por cada opción de comida (no por la comida en sí, porque
-- dos opciones de la misma comida —p.ej. "Pollo al horno" vs "Pollo a la
-- plancha"— tienen preparaciones distintas).
--
-- Diseño:
--  - Todos los campos son opcionales (NULL-able) y aditivos. Ningún dato
--    existente cambia.
--  - `instructions`: texto libre con saltos de línea (se renderiza con
--    `whitespace-pre-wrap` en el cliente; no necesitamos markdown todavía
--    para evitar añadir dependencias).
--  - `prep_time_minutes` / `cooking_time_minutes`: enteros positivos en
--    minutos. La app no hace cálculos con ellos más allá de mostrarlos.
--  - `servings`: entero >=1 que indica a cuántas personas rinde la receta
--    tal como está escrita.
--  - `notes`: texto libre corto (tip de preparación, sustituciones, etc.).
--
-- Aditiva, IF NOT EXISTS, no reescribe tablas, no toca datos.

ALTER TABLE nutrition_meal_options
  ADD COLUMN IF NOT EXISTS instructions TEXT;

COMMENT ON COLUMN nutrition_meal_options.instructions IS
  'Free-form preparation instructions (multi-line). Rendered with whitespace-pre-wrap on the client.';

ALTER TABLE nutrition_meal_options
  ADD COLUMN IF NOT EXISTS prep_time_minutes INTEGER;

COMMENT ON COLUMN nutrition_meal_options.prep_time_minutes IS
  'Preparation time in minutes (excludes cooking).';

ALTER TABLE nutrition_meal_options
  ADD COLUMN IF NOT EXISTS cooking_time_minutes INTEGER;

COMMENT ON COLUMN nutrition_meal_options.cooking_time_minutes IS
  'Cooking/oven/stove time in minutes.';

ALTER TABLE nutrition_meal_options
  ADD COLUMN IF NOT EXISTS servings INTEGER;

COMMENT ON COLUMN nutrition_meal_options.servings IS
  'How many people the recipe as written feeds. NULL = unspecified.';

ALTER TABLE nutrition_meal_options
  ADD COLUMN IF NOT EXISTS recipe_notes TEXT;

COMMENT ON COLUMN nutrition_meal_options.recipe_notes IS
  'Short extra note for the client (substitutions, tips, allergens, etc.).';

-- Defensive CHECK constraints: time and servings must be non-negative when
-- present. Uses NOT VALID to avoid scanning existing rows (all NULL right
-- now). Supabase applies this as a valid constraint for future inserts.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'nutrition_meal_options_prep_time_nonneg'
  ) THEN
    ALTER TABLE nutrition_meal_options
      ADD CONSTRAINT nutrition_meal_options_prep_time_nonneg
      CHECK (prep_time_minutes IS NULL OR prep_time_minutes >= 0) NOT VALID;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'nutrition_meal_options_cooking_time_nonneg'
  ) THEN
    ALTER TABLE nutrition_meal_options
      ADD CONSTRAINT nutrition_meal_options_cooking_time_nonneg
      CHECK (cooking_time_minutes IS NULL OR cooking_time_minutes >= 0) NOT VALID;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'nutrition_meal_options_servings_positive'
  ) THEN
    ALTER TABLE nutrition_meal_options
      ADD CONSTRAINT nutrition_meal_options_servings_positive
      CHECK (servings IS NULL OR servings >= 1) NOT VALID;
  END IF;
END
$$;
