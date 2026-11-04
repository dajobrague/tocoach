-- Indexes for the trainer exercise library once trainers hold hundreds of
-- exercises (RepDB catalog adds): GET /api/exercises searches name with
-- ILIKE '%q%', filters by muscle (primary/secondary arrays) and lists a
-- trainer's rows newest first. All idempotent.
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

CREATE INDEX IF NOT EXISTS exercises_name_trgm_idx
    ON exercises USING GIN (name extensions.gin_trgm_ops);

CREATE INDEX IF NOT EXISTS exercises_primary_muscles_idx
    ON exercises USING GIN (primary_muscles);

CREATE INDEX IF NOT EXISTS exercises_secondary_muscles_idx
    ON exercises USING GIN (secondary_muscles);

CREATE INDEX IF NOT EXISTS exercises_trainer_created_idx
    ON exercises (trainer_id, created_at DESC);
