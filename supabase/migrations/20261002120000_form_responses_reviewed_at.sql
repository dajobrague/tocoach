-- Check-ins stay editable by the client until the trainer marks them reviewed
-- (same flow as technique videos). NULL = pending review.
ALTER TABLE public.form_responses
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
