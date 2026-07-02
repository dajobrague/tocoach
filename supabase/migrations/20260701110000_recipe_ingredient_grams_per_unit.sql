-- Recipe ingredients: grams-per-piece for unit="u" lines
--
-- Recipe lines now carry an editable quantity + unit (g / ml / lt / u). Grams
-- and millilitres convert 1:1, litres ×1000, but a piece ("u") has no intrinsic
-- weight — so store its grams-per-piece here (e.g. 1 egg = 60 g) and the macro
-- rollup multiplies quantity × grams_per_unit. Nullable: only piece lines set
-- it; g/ml/lt rows stay NULL, as do all existing rows (no backfill needed —
-- they read as grams).

ALTER TABLE recipe_ingredients
    ADD COLUMN IF NOT EXISTS grams_per_unit NUMERIC;

COMMENT ON COLUMN recipe_ingredients.grams_per_unit IS
    'Grams per piece for unit="u" lines; NULL for g/ml/lt.';
