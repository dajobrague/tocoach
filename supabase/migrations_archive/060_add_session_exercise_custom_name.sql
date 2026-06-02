-- Add custom_name to session_exercises so each instance can override the library exercise name
-- When NULL, the display falls back to the exercises.name from the library
ALTER TABLE session_exercises
ADD COLUMN IF NOT EXISTS custom_name TEXT;