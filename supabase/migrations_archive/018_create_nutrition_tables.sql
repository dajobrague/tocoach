-- Create nutrition management tables
-- All tables are tenant-scoped with RLS following the pattern from training tables
-- =====================================================
-- NUTRITION PLANS
-- =====================================================
-- Nutrition plans assigned to clients
CREATE TABLE IF NOT EXISTS nutrition_plans (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_host TEXT NOT NULL REFERENCES tenants(host) ON DELETE CASCADE,
    client_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    trainer_id UUID NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status TEXT NOT NULL DEFAULT 'active' CHECK (
        status IN ('active', 'completed', 'paused', 'cancelled')
    ),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT name_not_empty CHECK (name != '')
);
-- =====================================================
-- NUTRITION DAYS
-- =====================================================
-- Days within a nutrition plan
CREATE TABLE IF NOT EXISTS nutrition_days (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nutrition_plan_id UUID NOT NULL REFERENCES nutrition_plans(id) ON DELETE CASCADE,
    tenant_host TEXT NOT NULL REFERENCES tenants(host) ON DELETE CASCADE,
    day_label TEXT NOT NULL,
    day_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT day_label_not_empty CHECK (day_label != '')
);
-- =====================================================
-- NUTRITION MEALS
-- =====================================================
-- Meals within a day (with meal-level macros)
CREATE TABLE IF NOT EXISTS nutrition_meals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nutrition_day_id UUID NOT NULL REFERENCES nutrition_days(id) ON DELETE CASCADE,
    tenant_host TEXT NOT NULL REFERENCES tenants(host) ON DELETE CASCADE,
    label TEXT NOT NULL,
    meal_order INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    -- Meal-level macros (requested by trainer for easier diet uploads)
    protein DECIMAL(10, 2) DEFAULT 0,
    carbs DECIMAL(10, 2) DEFAULT 0,
    fats DECIMAL(10, 2) DEFAULT 0,
    calories DECIMAL(10, 2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT label_not_empty CHECK (label != '')
);
-- =====================================================
-- NUTRITION INGREDIENTS
-- =====================================================
-- Ingredients within meals (keeping nutritional data for flexibility)
CREATE TABLE IF NOT EXISTS nutrition_ingredients (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nutrition_meal_id UUID NOT NULL REFERENCES nutrition_meals(id) ON DELETE CASCADE,
    tenant_host TEXT NOT NULL REFERENCES tenants(host) ON DELETE CASCADE,
    name TEXT NOT NULL,
    quantity TEXT NOT NULL,
    unit TEXT NOT NULL,
    ingredient_order INTEGER NOT NULL DEFAULT 0,
    -- Optional ingredient-level nutritional data
    protein DECIMAL(10, 2),
    carbs DECIMAL(10, 2),
    fats DECIMAL(10, 2),
    calories DECIMAL(10, 2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT name_not_empty CHECK (name != '')
);
-- =====================================================
-- INDEXES
-- =====================================================
-- Nutrition plans indexes
CREATE INDEX IF NOT EXISTS nutrition_plans_tenant_idx ON nutrition_plans(tenant_host);
CREATE INDEX IF NOT EXISTS nutrition_plans_client_idx ON nutrition_plans(client_id);
CREATE INDEX IF NOT EXISTS nutrition_plans_trainer_idx ON nutrition_plans(trainer_id);
CREATE INDEX IF NOT EXISTS nutrition_plans_status_idx ON nutrition_plans(status);
-- Nutrition days indexes
CREATE INDEX IF NOT EXISTS nutrition_days_tenant_idx ON nutrition_days(tenant_host);
CREATE INDEX IF NOT EXISTS nutrition_days_plan_idx ON nutrition_days(nutrition_plan_id);
CREATE INDEX IF NOT EXISTS nutrition_days_order_idx ON nutrition_days(nutrition_plan_id, day_order);
-- Nutrition meals indexes
CREATE INDEX IF NOT EXISTS nutrition_meals_tenant_idx ON nutrition_meals(tenant_host);
CREATE INDEX IF NOT EXISTS nutrition_meals_day_idx ON nutrition_meals(nutrition_day_id);
CREATE INDEX IF NOT EXISTS nutrition_meals_order_idx ON nutrition_meals(nutrition_day_id, meal_order);
-- Nutrition ingredients indexes
CREATE INDEX IF NOT EXISTS nutrition_ingredients_tenant_idx ON nutrition_ingredients(tenant_host);
CREATE INDEX IF NOT EXISTS nutrition_ingredients_meal_idx ON nutrition_ingredients(nutrition_meal_id);
CREATE INDEX IF NOT EXISTS nutrition_ingredients_order_idx ON nutrition_ingredients(nutrition_meal_id, ingredient_order);
-- =====================================================
-- TRIGGERS
-- =====================================================
CREATE TRIGGER update_nutrition_plans_updated_at BEFORE
UPDATE ON nutrition_plans FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_nutrition_days_updated_at BEFORE
UPDATE ON nutrition_days FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_nutrition_meals_updated_at BEFORE
UPDATE ON nutrition_meals FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_nutrition_ingredients_updated_at BEFORE
UPDATE ON nutrition_ingredients FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================
ALTER TABLE nutrition_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE nutrition_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE nutrition_meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE nutrition_ingredients ENABLE ROW LEVEL SECURITY;
-- =====================================================
-- RLS POLICIES - NUTRITION PLANS
-- =====================================================
-- Trainers can manage nutrition plans (authorization handled at application level)
CREATE POLICY "Trainers can manage nutrition plans" ON nutrition_plans FOR ALL TO authenticated USING (true) WITH CHECK (true);
-- Note: Client RLS policies not added because clients table uses bigint IDs, not auth.uid() UUIDs
-- Clients access nutrition data through API endpoints with proper authentication
-- =====================================================
-- RLS POLICIES - NUTRITION DAYS
-- =====================================================
-- Trainers can manage nutrition days (authorization handled at application level)
CREATE POLICY "Trainers can manage nutrition days" ON nutrition_days FOR ALL TO authenticated USING (true) WITH CHECK (true);
-- =====================================================
-- RLS POLICIES - NUTRITION MEALS
-- =====================================================
-- Trainers can manage nutrition meals (authorization handled at application level)
CREATE POLICY "Trainers can manage nutrition meals" ON nutrition_meals FOR ALL TO authenticated USING (true) WITH CHECK (true);
-- =====================================================
-- RLS POLICIES - NUTRITION INGREDIENTS
-- =====================================================
-- Trainers can manage nutrition ingredients (authorization handled at application level)
CREATE POLICY "Trainers can manage nutrition ingredients" ON nutrition_ingredients FOR ALL TO authenticated USING (true) WITH CHECK (true);
-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON TABLE nutrition_plans IS 'Nutrition plans assigned to clients by trainers';
COMMENT ON TABLE nutrition_days IS 'Days within a nutrition plan';
COMMENT ON TABLE nutrition_meals IS 'Meals within a day with meal-level macros for easier diet uploads';
COMMENT ON TABLE nutrition_ingredients IS 'Ingredients within meals with optional nutritional data';
COMMENT ON COLUMN nutrition_meals.protein IS 'Meal-level protein in grams';
COMMENT ON COLUMN nutrition_meals.carbs IS 'Meal-level carbohydrates in grams';
COMMENT ON COLUMN nutrition_meals.fats IS 'Meal-level fats in grams';
COMMENT ON COLUMN nutrition_meals.calories IS 'Meal-level calories in kcal';