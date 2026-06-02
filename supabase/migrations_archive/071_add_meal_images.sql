-- Meal images: storage URL per meal, per-plan visibility toggle for client app

ALTER TABLE nutrition_meals
ADD COLUMN IF NOT EXISTS image_url TEXT;

COMMENT ON COLUMN nutrition_meals.image_url IS 'Public URL for meal image in Supabase Storage (meal-images bucket)';

ALTER TABLE nutrition_plans
ADD COLUMN IF NOT EXISTS show_meal_images BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN nutrition_plans.show_meal_images IS 'When true, client app may show meal images; trainers can hide images per plan';
