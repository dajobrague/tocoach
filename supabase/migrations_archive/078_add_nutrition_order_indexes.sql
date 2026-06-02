-- Migración 078: Compound indexes to speed up ordered reads in nutrition tree
--
-- Context: The endpoints that load the nested nutrition tree (plan -> days ->
-- meals -> options -> ingredients) query each child level with an
--   `.eq(parent_fk, X).order(child_order, ASC)`
-- pattern. Today we have single-column indexes on the parent FK columns
-- (created in migrations 018 and 073), which means Postgres has to find the
-- rows and then sort them in memory. Compound (parent_fk, child_order) indexes
-- let the planner return already-sorted rows directly, which is faster under
-- the N+1 patterns we are about to refactor and also makes the pre-refactor
-- code measurably quicker.
--
-- Safety: all indexes use IF NOT EXISTS, are additive, and do not rewrite the
-- table. Creation on these (relatively small) tables takes milliseconds.

-- nutrition_meal_options: parent = meal_id, child order = option_order
CREATE INDEX IF NOT EXISTS nutrition_meal_options_meal_order_idx
  ON nutrition_meal_options (meal_id, option_order);

-- nutrition_ingredients: parent = option_id, child order = ingredient_order
-- (option_id became the canonical parent in migration 073)
CREATE INDEX IF NOT EXISTS nutrition_ingredients_option_order_idx
  ON nutrition_ingredients (option_id, ingredient_order);
