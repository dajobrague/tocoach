-- Add template support to nutrition plans
-- This allows trainers to save nutrition plans as reusable templates
-- Add is_template column to nutrition_plans
ALTER TABLE nutrition_plans
ADD COLUMN is_template BOOLEAN DEFAULT false;
-- Remove NOT NULL constraint from client_id for templates
-- Templates don't have a client_id until they're instantiated
ALTER TABLE nutrition_plans
ALTER COLUMN client_id DROP NOT NULL;
-- Create index for efficient template queries
CREATE INDEX IF NOT EXISTS nutrition_plans_is_template_idx ON nutrition_plans(is_template, trainer_id);
-- Add comments
COMMENT ON COLUMN nutrition_plans.is_template IS 'Whether this is a reusable template (true) or an active client plan (false)';
-- Update RLS policies to handle templates
-- Templates and client plans are both viewable by the trainer who created them
DROP POLICY IF EXISTS "Trainers can view nutrition plans" ON nutrition_plans;
CREATE POLICY "Trainers can view nutrition plans" ON nutrition_plans FOR
SELECT USING (auth.uid() = trainer_id);