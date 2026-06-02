-- Documentation and comments for training metadata structure
-- This migration documents how to use the metadata JSONB fields in training tables
-- session_exercises.metadata should store:
-- {
--   "tempo": "Pausa Final Excéntrica" | "Explosivo" | "Normal" | etc,
--   "training_system": "Series Rectas" | "Repeticiones Totales" | "Drop Sets" | etc,
--   "rest_description": "El necesario para rendir al 100%" | "90 segundos" | etc
-- }
COMMENT ON COLUMN session_exercises.metadata IS 'JSONB field storing: tempo (string), training_system (string), rest_description (string), and other custom exercise parameters';
-- sessions.metadata should store:
-- {
--   "day_of_week": "Lun" | "Mar" | "Mie" | "Jue" | "Vie" | "Sab" | "Dom"
-- }
COMMENT ON COLUMN sessions.metadata IS 'JSONB field storing: day_of_week (string) for default scheduling, and other session-specific parameters';
-- programs.metadata can store program-level custom fields:
-- {
--   "type": "Strength" | "HIIT" | "Functional" | "Hypertrophy",
--   "division": "Full Body" | "Upper/Lower" | "Push/Pull/Legs",
--   "sessions_per_week": 2 | 3 | 4 | etc
-- }
COMMENT ON COLUMN programs.metadata IS 'JSONB field storing: type (string), division (string), sessions_per_week (number), and other program-specific parameters';
-- Add index for querying by day of week in sessions metadata
CREATE INDEX IF NOT EXISTS sessions_metadata_day_idx ON sessions USING GIN ((metadata->'day_of_week'));
-- Add index for querying by program type in metadata
CREATE INDEX IF NOT EXISTS programs_metadata_type_idx ON programs USING GIN ((metadata->'type'));