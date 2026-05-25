-- Add training_date to exercise_logs: the date the client selected in the
-- date picker when logging. Decoupled from scheduled_sessions.scheduled_date
-- (which is a side effect of session resolution) and from completed_at
-- (which is when they physically saved).

ALTER TABLE exercise_logs
  ADD COLUMN IF NOT EXISTS training_date DATE;

-- Backfill from the linked scheduled_session's date.
UPDATE exercise_logs el
   SET training_date = ss.scheduled_date::date
  FROM scheduled_sessions ss
 WHERE el.scheduled_session_id = ss.id
   AND el.training_date IS NULL;

-- For any stragglers without a scheduled_session, fall back to completed_at.
UPDATE exercise_logs
   SET training_date = completed_at::date
 WHERE training_date IS NULL
   AND completed_at IS NOT NULL;

-- Index for the date-range queries both views run.
CREATE INDEX IF NOT EXISTS idx_exercise_logs_training_date
    ON exercise_logs (client_id, training_date);
