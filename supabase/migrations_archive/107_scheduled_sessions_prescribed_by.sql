-- Distinción "quién creó/es dueño" de la fila scheduled_sessions.
--
-- 'trainer' = el entrenador la creó vía override por-fecha o
--             session swap (replace_scheduled_session_overrides RPC).
-- 'client'  = el cliente la creó implícitamente al loguear un
--             ejercicio de una sesión distinta a la recomendada
--             (upsert_scheduled_session RPC desde el POST de
--             exercise-logs).
--
-- Por qué importa: la pantalla del cliente mostraba como "Recomendado
-- por tu entrenador" la sesión apuntada por scheduled_sessions, pero
-- esa fila también se crea cuando el cliente diverge del microciclo y
-- loguea otra sesión. Sin esta columna no había forma de distinguir
-- "el entrenador prescribió esto" de "el cliente eligió esto", así que
-- el badge mentía: después del primer log del cliente, el badge
-- empezaba a apuntar a la elección del cliente como si fuera
-- recomendación del entrenador.
--
-- Backfill: filas existentes → 'trainer'. Justificación: rows tribales,
-- no hay información histórica para distinguir retroactivamente.
-- Defaultear a 'trainer' preserva el comportamiento previo (todo se
-- trataba implícitamente como recomendación del entrenador). Las RPCs
-- updateadas en 109/110 escriben el valor correcto desde acá.

ALTER TABLE scheduled_sessions
  ADD COLUMN IF NOT EXISTS prescribed_by TEXT NOT NULL DEFAULT 'trainer';

ALTER TABLE scheduled_sessions
  DROP CONSTRAINT IF EXISTS scheduled_sessions_prescribed_by_check;

ALTER TABLE scheduled_sessions
  ADD CONSTRAINT scheduled_sessions_prescribed_by_check
  CHECK (prescribed_by IN ('trainer', 'client'));

-- Índice parcial sobre 'client' — el resolver consulta por 'trainer'
-- (default), así que no necesita índice. El parcial mantiene el costo
-- de mantenimiento bajo (la mayoría de filas son 'trainer').
CREATE INDEX IF NOT EXISTS idx_scheduled_sessions_prescribed_by_client
  ON scheduled_sessions(client_id, scheduled_date)
  WHERE prescribed_by = 'client';
