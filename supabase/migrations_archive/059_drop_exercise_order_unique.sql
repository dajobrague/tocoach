-- Drop the unique constraint on exercise_order to allow drag-and-drop reordering
-- The application logic manages ordering; the constraint prevents batch updates during reorder
ALTER TABLE session_exercises DROP CONSTRAINT IF EXISTS unique_session_exercise_order;