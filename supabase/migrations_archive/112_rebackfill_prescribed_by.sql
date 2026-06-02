-- Re-backfill de scheduled_sessions.prescribed_by para corregir la
-- inferencia conservadora de migration 107.
--
-- Contexto: 107 marcó TODAS las filas existentes como 'trainer' por
-- defecto (no había información retroactiva para distinguir). Pero
-- desde el push de ayer (migrations 104-106 + ruteo de los creates a
-- través de upsert_scheduled_session), CADA fila se queda "pillada"
-- con el session_id que la creó: si el cliente loguea una sesión
-- distinta a la del microciclo, esa elección queda como prescripción
-- para todo el sistema. La pantalla de Métricas del trainer terminaba
-- mostrando la elección del cliente como si fuera lo prescrito.
--
-- Caso reportado (cliente 179 - Pedro Orellana, trainer Carlos Torres):
--   - 05-12: microciclo dice Torso Fuerza, ss dice "Bíceps y Pierna"
--     (cliente divergió, 5 logs de Bíceps).
--   - 05-13: microciclo dice Bíceps y Pierna, ss matches (1 log).
--   - 05-14: microciclo dice REST, ss dice "Bíceps y Pierna"
--     (cliente entrenó en día de descanso, 2 logs).
--
-- Heurística para flippear a 'client' (3 condiciones simultáneas):
--   1. NO tiene scheduled_session_exercises (no hay override
--      per-ejercicio del trainer — esos son siempre prescripción).
--   2. SÍ tiene exercise_logs ligados (hubo actividad real del cliente,
--      no es un swap "dry" del trainer).
--   3. session_id IS DISTINCT FROM el slot del microciclo para esa
--      fecha (el cliente eligió algo distinto a lo prescrito por el
--      microciclo).
--
-- Lo que queda como 'trainer':
--   - Filas con per-exercise overrides → trainer prescribió explícito.
--   - Filas que coinciden con el microciclo template → cliente hizo lo
--     recomendado (ambiguo en autoría, inocuo en semántica: prescripción
--     y actividad coinciden).
--   - Filas sin logs (trainer creó pero cliente nunca entrenó).
--
-- Caso falso-positivo conocido: trainer hace swap manual a una sesión
-- distinta al template SIN editar ejercicios per-set, después el
-- cliente loguea sobre eso. La heurística la flippea a 'client'
-- incorrectamente. Mitigación: el trainer puede re-aplicar el swap
-- desde el editor del día y la nueva RPC (post-110) la marca como
-- 'trainer' definitivamente. Es escenario raro y self-healing.

UPDATE scheduled_sessions ss
SET prescribed_by = 'client'
WHERE ss.prescribed_by = 'trainer'
  AND NOT EXISTS (
    SELECT 1 FROM scheduled_session_exercises sse
    WHERE sse.scheduled_session_id = ss.id
  )
  AND EXISTS (
    SELECT 1 FROM exercise_logs el
    WHERE el.scheduled_session_id = ss.id
  )
  AND EXISTS (
    SELECT 1
    FROM client_programs cp
    JOIN microcycles m ON m.client_program_id = cp.id
    JOIN microcycle_slots slot ON slot.microcycle_id = m.id
    WHERE cp.client_id = ss.client_id
      AND cp.status = 'active'
      AND ss.scheduled_date >= m.start_date
      AND slot.day_index = (
        (ss.scheduled_date - m.start_date) % m.duration_days
      ) + 1
      AND slot.session_id IS DISTINCT FROM ss.session_id
  );
