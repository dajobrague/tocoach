-- Apply nutrition enhancements
-- Run this directly in Supabase SQL Editor
-- Migration 028: Add day-level macros
ALTER TABLE nutrition_days
ADD COLUMN IF NOT EXISTS protein DECIMAL(10, 2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS carbs DECIMAL(10, 2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS fats DECIMAL(10, 2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS calories DECIMAL(10, 2) DEFAULT 0;
-- Migration 029: Add weekdays assignment
ALTER TABLE nutrition_days
ADD COLUMN IF NOT EXISTS weekdays INTEGER [] DEFAULT '{}';
CREATE INDEX IF NOT EXISTS nutrition_days_weekdays_idx ON nutrition_days USING GIN (weekdays);
-- Migration 030: Add template support to nutrition plans
ALTER TABLE nutrition_plans
ADD COLUMN IF NOT EXISTS is_template BOOLEAN DEFAULT false;
-- Remove NOT NULL constraint from client_id for templates
ALTER TABLE nutrition_plans
ALTER COLUMN client_id DROP NOT NULL;
-- Create index for efficient template queries
CREATE INDEX IF NOT EXISTS nutrition_plans_is_template_idx ON nutrition_plans(is_template, trainer_id);
-- Update RLS policies to handle templates
-- Templates and client plans are both viewable by the trainer who created them
DROP POLICY IF EXISTS "Trainers can view nutrition plans" ON nutrition_plans;
CREATE POLICY "Trainers can view nutrition plans" ON nutrition_plans FOR
SELECT USING (auth.uid() = trainer_id);
-- Verify all columns exist
SELECT column_name,
    data_type
FROM information_schema.columns
WHERE table_name IN ('nutrition_days', 'nutrition_plans')
    AND column_name IN (
        'protein',
        'carbs',
        'fats',
        'calories',
        'weekdays',
        'is_template'
    )
ORDER BY table_name,
    column_name;