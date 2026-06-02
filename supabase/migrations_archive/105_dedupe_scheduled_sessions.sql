-- Dedupe scheduled_sessions: deja una fila canónica por
-- (client_id, scheduled_date) y relinkea exercise_logs +
-- scheduled_session_exercises al canónico antes de borrar los demás.
--
-- Precondición: migration 104 + cambios de código deployados (los 3
-- INSERT paths usan ahora upsert_scheduled_session con advisory lock).
-- Sin esto el dedup deja la puerta abierta a nuevos duplicados.
--
-- Selección de canónico para cada grupo (client_id, scheduled_date):
--   Prioridad de preservación:
--     1. La fila con MÁS logs ligados (preservar history del cliente)
--     2. La fila con MÁS overrides (preservar trabajo del trainer)
--     3. La fila más recientemente actualizada (updated_at DESC)
--     4. La fila más recientemente creada (created_at DESC)
--     5. ID ASC (deterministic tiebreak)
--
-- Pasos atómicos (en una sola transacción):
--   1. Identificar canónicos
--   2. Relinkear exercise_logs.scheduled_session_id → canónico
--   3. Relinkear scheduled_session_exercises.scheduled_session_id →
--      canónico (con resolución de UNIQUE conflict por exercise_order
--      preservando la fila más reciente del child)
--   4. Borrar duplicados (no canónicos)
--
-- Tras ejecutar:
--   - 0 duplicados por (client_id, scheduled_date) — verificado con
--     audit post-migration
--   - exercise_logs e overrides quedan ligados a la fila canónica
--   - migration 106 puede ahora aplicar UNIQUE constraint sin error

BEGIN;

-- Paso 0: tabla temporal con la asignación dup → canonical
CREATE TEMP TABLE _dedupe_map ON COMMIT DROP AS
WITH ranked AS (
  SELECT
    ss.id,
    ss.client_id,
    ss.scheduled_date,
    (
      SELECT count(*) FROM exercise_logs el
      WHERE el.scheduled_session_id = ss.id
    ) AS n_logs,
    (
      SELECT count(*) FROM scheduled_session_exercises sse
      WHERE sse.scheduled_session_id = ss.id
    ) AS n_overrides,
    ss.updated_at,
    ss.created_at
  FROM scheduled_sessions ss
  WHERE EXISTS (
    SELECT 1 FROM scheduled_sessions ss2
    WHERE ss2.client_id = ss.client_id
      AND ss2.scheduled_date = ss.scheduled_date
      AND ss2.id <> ss.id
  )
),
canonical_per_group AS (
  SELECT
    id,
    client_id,
    scheduled_date,
    ROW_NUMBER() OVER (
      PARTITION BY client_id, scheduled_date
      ORDER BY
        n_logs DESC,
        n_overrides DESC,
        updated_at DESC NULLS LAST,
        created_at DESC NULLS LAST,
        id ASC
    ) AS rank_in_group
  FROM ranked
)
SELECT
  dup.id AS dup_id,
  canon.id AS canonical_id
FROM canonical_per_group dup
JOIN canonical_per_group canon
  ON canon.client_id = dup.client_id
 AND canon.scheduled_date = dup.scheduled_date
 AND canon.rank_in_group = 1
WHERE dup.rank_in_group > 1;

-- Paso 1: relinkear exercise_logs
UPDATE exercise_logs el
SET scheduled_session_id = m.canonical_id
FROM _dedupe_map m
WHERE el.scheduled_session_id = m.dup_id;

-- Paso 2: relinkear scheduled_session_exercises. Aquí hay UNIQUE
-- (scheduled_session_id, exercise_order) que puede chocar si la fila
-- canónica YA tiene un override para el mismo exercise_order. En ese
-- caso preservamos el override del canónico (más reciente por
-- selección) y borramos el del duplicado.
DELETE FROM scheduled_session_exercises sse_dup
USING _dedupe_map m
WHERE sse_dup.scheduled_session_id = m.dup_id
  AND EXISTS (
    SELECT 1 FROM scheduled_session_exercises sse_canon
    WHERE sse_canon.scheduled_session_id = m.canonical_id
      AND sse_canon.exercise_order = sse_dup.exercise_order
  );

UPDATE scheduled_session_exercises sse
SET scheduled_session_id = m.canonical_id
FROM _dedupe_map m
WHERE sse.scheduled_session_id = m.dup_id;

-- Paso 3: borrar las filas duplicadas. Los hijos (overrides + sets)
-- de las dup rows ya fueron movidos al canónico o borrados.
DELETE FROM scheduled_sessions
WHERE id IN (SELECT dup_id FROM _dedupe_map);

-- Verificación: 0 duplicados restantes
DO $$
DECLARE
  v_remaining INTEGER;
BEGIN
  SELECT count(*) INTO v_remaining
  FROM (
    SELECT 1
    FROM scheduled_sessions
    GROUP BY client_id, scheduled_date
    HAVING count(*) > 1
  ) sub;

  IF v_remaining > 0 THEN
    RAISE EXCEPTION
      'Dedupe incompleto: % grupos duplicados restantes', v_remaining;
  END IF;
END $$;

COMMIT;
