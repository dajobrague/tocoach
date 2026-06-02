-- Distinción "autosaved en progreso" vs "finalizado por el cliente".
--
-- Con el autosave en el modal de log, una fila en `exercise_logs`
-- aparece apenas el cliente tipea algo. Antes equiparábamos "existe el
-- log" con "ejercicio hecho", pero eso marca como "Hecho" un ejercicio
-- que el cliente nunca terminó (solo escribió la primera serie y se
-- fue). Agregamos `finalized_at`: se setea solo cuando tocan
-- "Finalizado". El frontend usa esto para mostrar tres estados:
-- not_started / in_progress / completed.
--
-- Backfill: los logs existentes vienen del flujo viejo (botón Guardar)
-- que era un "finalizado" implícito. Los marcamos como finalizados al
-- mismo timestamp de completed_at para no romperle el historial al
-- cliente. Logs nuevos arrancan con finalized_at NULL hasta que el
-- cliente toque Finalizado.

ALTER TABLE exercise_logs
  ADD COLUMN IF NOT EXISTS finalized_at TIMESTAMPTZ;

UPDATE exercise_logs
SET finalized_at = completed_at
WHERE finalized_at IS NULL
  AND completed_at IS NOT NULL;
