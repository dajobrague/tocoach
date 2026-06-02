-- Migración 075: Fix RLS policies for nutrition core tables (anon + authenticated)

-- NUTRITION PLANS
DROP POLICY IF EXISTS "Trainers can manage nutrition plans" ON nutrition_plans;
DROP POLICY IF EXISTS "Trainers can view nutrition plans" ON nutrition_plans;
CREATE POLICY "Trainers can manage nutrition plans" ON nutrition_plans 
  FOR ALL TO anon, authenticated 
  USING (true) 
  WITH CHECK (true);

-- NUTRITION DAYS
DROP POLICY IF EXISTS "Trainers can manage nutrition days" ON nutrition_days;
CREATE POLICY "Trainers can manage nutrition days" ON nutrition_days 
  FOR ALL TO anon, authenticated 
  USING (true) 
  WITH CHECK (true);

-- NUTRITION MEALS
DROP POLICY IF EXISTS "Trainers can manage nutrition meals" ON nutrition_meals;
CREATE POLICY "Trainers can manage nutrition meals" ON nutrition_meals 
  FOR ALL TO anon, authenticated 
  USING (true) 
  WITH CHECK (true);

-- NUTRITION INGREDIENTS
DROP POLICY IF EXISTS "Trainers can manage nutrition ingredients" ON nutrition_ingredients;
CREATE POLICY "Trainers can manage nutrition ingredients" ON nutrition_ingredients 
  FOR ALL TO anon, authenticated 
  USING (true) 
  WITH CHECK (true);
