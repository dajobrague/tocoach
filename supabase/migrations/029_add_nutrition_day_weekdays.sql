-- Add weekdays array to nutrition_days table
-- This allows trainers to assign specific days of the week to each nutrition day
-- Supports multiple days per nutrition day (e.g., "Día 1" on Monday, Thursday, and Sunday)
-- Uses integers 0-6 where 0=Sunday, 1=Monday, ..., 6=Saturday

ALTER TABLE nutrition_days
ADD COLUMN weekdays INTEGER[] DEFAULT '{}';

-- Add index for querying by weekdays
CREATE INDEX IF NOT EXISTS nutrition_days_weekdays_idx ON nutrition_days USING GIN (weekdays);

-- Add comment to document the purpose
COMMENT ON COLUMN nutrition_days.weekdays IS 'Days of the week this nutrition day applies to (0=Sunday, 1=Monday, ..., 6=Saturday). Can have multiple values for days that repeat.';

