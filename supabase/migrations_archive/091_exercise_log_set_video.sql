-- Per-set video on exercise_log_sets.
--
-- Hasta ahora el video del cliente se guardaba en `exercise_logs.video_url`,
-- un único video por ejercicio. El cliente quiere poder subir un video
-- por SERIE (especialmente útil en pesos altos donde no todas las
-- series son iguales). Agregamos la columna nullable acá; la columna
-- legacy `exercise_logs.video_url` se conserva para historial existente
-- (la UI hace fallback a mostrarlo en la primera serie en read-only).
--
-- Cardio sigue usando `exercise_logs.video_url` porque no tiene series.

ALTER TABLE exercise_log_sets
  ADD COLUMN IF NOT EXISTS video_url TEXT;
