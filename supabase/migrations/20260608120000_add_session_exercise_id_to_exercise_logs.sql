-- Per-slot attribution for exercise logs.
-- Logs previously linked only to exercise_id + scheduled_session_id, which
-- can't disambiguate the same library exercise reused across planned slots.
-- Add the specific planned slot (session_exercises.id). Nullable: legacy logs
-- and ambiguous/deleted-slot cases stay NULL; readers fall back to exercise_id.
ALTER TABLE public.exercise_logs
  ADD COLUMN IF NOT EXISTS session_exercise_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'exercise_logs_session_exercise_id_fkey'
  ) THEN
    ALTER TABLE public.exercise_logs
      ADD CONSTRAINT exercise_logs_session_exercise_id_fkey
      FOREIGN KEY (session_exercise_id)
      REFERENCES public.session_exercises(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_exercise_logs_session_exercise_id
  ON public.exercise_logs(session_exercise_id);

COMMENT ON COLUMN public.exercise_logs.session_exercise_id IS
  'The specific planned slot (session_exercises.id) this log was recorded against. NULL for legacy logs or when the slot was ambiguous/deleted; readers fall back to exercise_id matching.';

-- Backfill ONLY unambiguous logs: exactly one slot in the log's session has
-- that exercise_id. Ambiguous (same exercise twice in a session), null
-- scheduled_session_id, or deleted slots remain NULL.
UPDATE public.exercise_logs el
SET session_exercise_id = se.id
FROM public.scheduled_sessions ss
JOIN public.session_exercises se
  ON se.session_id = ss.session_id
WHERE el.session_exercise_id IS NULL
  AND el.scheduled_session_id = ss.id
  AND se.exercise_id = el.exercise_id
  AND (
    SELECT count(*) FROM public.session_exercises se2
    WHERE se2.session_id = ss.session_id
      AND se2.exercise_id = el.exercise_id
  ) = 1;
