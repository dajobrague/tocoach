-- Add default training parameters to exercises table
-- This allows trainers to pre-define default values that auto-fill when adding exercises to sessions
-- Add default training parameter columns
ALTER TABLE exercises
ADD COLUMN IF NOT EXISTS default_sets INTEGER,
    ADD COLUMN IF NOT EXISTS default_reps TEXT,
    ADD COLUMN IF NOT EXISTS default_tempo TEXT,
    ADD COLUMN IF NOT EXISTS default_rest_seconds INTEGER,
    ADD COLUMN IF NOT EXISTS default_training_system TEXT;
-- Add helpful comments
COMMENT ON COLUMN exercises.default_sets IS 'Default number of sets for this exercise (can be overridden per session)';
COMMENT ON COLUMN exercises.default_reps IS 'Default repetitions (e.g., "10-12", "AMRAP") for this exercise';
COMMENT ON COLUMN exercises.default_tempo IS 'Default tempo (e.g., "Explosivo", "Pausa Final Excéntrica") for this exercise';
COMMENT ON COLUMN exercises.default_rest_seconds IS 'Default rest time in seconds between sets';
COMMENT ON COLUMN exercises.default_training_system IS 'Default training system (e.g., "Series Rectas", "Drop Sets") for this exercise';