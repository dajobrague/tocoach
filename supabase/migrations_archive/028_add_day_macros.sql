-- Add macro columns to nutrition_days table
-- This allows trainers to set day-level macros that can be:
-- 1. Auto-calculated from meal macros
-- 2. Manually entered without meal macros
-- 3. A combination of both (manual + meal macros)
ALTER TABLE nutrition_days
ADD COLUMN protein DECIMAL(10, 2) DEFAULT 0,
    ADD COLUMN carbs DECIMAL(10, 2) DEFAULT 0,
    ADD COLUMN fats DECIMAL(10, 2) DEFAULT 0,
    ADD COLUMN calories DECIMAL(10, 2) DEFAULT 0;
-- Add comments to document the purpose
COMMENT ON COLUMN nutrition_days.protein IS 'Day-level protein in grams - can be manually set or calculated from meals';
COMMENT ON COLUMN nutrition_days.carbs IS 'Day-level carbohydrates in grams - can be manually set or calculated from meals';
COMMENT ON COLUMN nutrition_days.fats IS 'Day-level fats in grams - can be manually set or calculated from meals';
COMMENT ON COLUMN nutrition_days.calories IS 'Day-level calories in kcal - can be manually set or calculated from meals';