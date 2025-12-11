-- Replace difficulty_level field with movement_pattern in exercises table
-- This migration:
-- 1. Adds the new movement_pattern column (text, nullable)
-- 2. Drops the CHECK constraint on difficulty_level
-- 3. Drops the difficulty_level column
-- Add new movement_pattern column
ALTER TABLE exercises
ADD COLUMN movement_pattern TEXT;
-- Drop the CHECK constraint on difficulty_level
-- First, we need to find and drop the constraint
ALTER TABLE exercises DROP CONSTRAINT IF EXISTS exercises_difficulty_level_check;
-- Drop the difficulty_level column
ALTER TABLE exercises DROP COLUMN IF EXISTS difficulty_level;
-- Add comment
COMMENT ON COLUMN exercises.movement_pattern IS 'Movement pattern classification (e.g., Sentadilla, Bisagra de cadera, Empuje horizontal, Tracción vertical)';