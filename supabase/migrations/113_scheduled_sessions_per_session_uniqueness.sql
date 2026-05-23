-- Widen scheduled_sessions uniqueness from (client, date) to (client, date,
-- session_id) and update upsert_scheduled_session accordingly.
--
-- Background (ver spec 2026-05-23 §Problem evidence):
--   Migration 106 introdujo UNIQUE (client_id, scheduled_date) para
--   colapsar duplicados de concurrencia. Esa decisión accidentalmente
--   forzó "una sesión por día por cliente" en el modelo. En la práctica
--   los clientes a veces tocan o entrenan varias sesiones el mismo día,
--   y todos sus logs quedaban pegados al primer scheduled_session creado
--   ese día — con session_id equivocado para los demás logs.
--
-- Esta migración:
--   1. Asegura session_id no nulo (todas las filas hoy ya lo tienen).
--   2. Reemplaza UNIQUE (client_id, scheduled_date) por
--      UNIQUE (client_id, scheduled_date, session_id).
--   3. Reescribe upsert_scheduled_session para que el lock advisory y el
--      SELECT incluyan session_id en su key, permitiendo múltiples filas
--      por (client, date), una por sesión tocada.
--
-- No backfill: las filas históricas polucionadas se quedan donde están.
-- A partir de esta migración, cada (client, date, session_id) tendrá su
-- propia fila — ver spec §7.

BEGIN;

-- 0. Dedupe existing (client_id, scheduled_date, session_id) duplicates.
WITH ranked AS (
  SELECT
    ss.id,
    ss.client_id,
    ss.scheduled_date,
    ss.session_id,
    ss.created_at,
    (SELECT COUNT(*) FROM exercise_logs el
       WHERE el.scheduled_session_id = ss.id) AS log_count,
    ROW_NUMBER() OVER (
      PARTITION BY ss.client_id, ss.scheduled_date, ss.session_id
      ORDER BY
        (SELECT COUNT(*) FROM exercise_logs el
           WHERE el.scheduled_session_id = ss.id) DESC,
        ss.created_at ASC,
        ss.id ASC
    ) AS rn
  FROM scheduled_sessions ss
  WHERE ss.session_id IS NOT NULL
),
survivors AS (
  SELECT client_id, scheduled_date, session_id, id AS survivor_id
  FROM ranked
  WHERE rn = 1
),
losers AS (
  SELECT r.id AS loser_id, s.survivor_id
  FROM ranked r
  JOIN survivors s
    ON s.client_id = r.client_id
   AND s.scheduled_date = r.scheduled_date
   AND s.session_id = r.session_id
  WHERE r.rn > 1
)
UPDATE exercise_logs el
SET scheduled_session_id = l.survivor_id
FROM losers l
WHERE el.scheduled_session_id = l.loser_id;

-- Preservar la "intención del trainer" del grupo: si CUALQUIER fila del
-- grupo era prescribed_by='trainer', el survivor también lo es.
UPDATE scheduled_sessions ss
SET prescribed_by = 'trainer',
    updated_at = NOW()
FROM (
  SELECT
    client_id, scheduled_date, session_id, id,
    ROW_NUMBER() OVER (
      PARTITION BY client_id, scheduled_date, session_id
      ORDER BY
        (SELECT COUNT(*) FROM exercise_logs el
           WHERE el.scheduled_session_id = scheduled_sessions.id) DESC,
        created_at ASC,
        id ASC
    ) AS rn
  FROM scheduled_sessions
  WHERE session_id IS NOT NULL
) s
WHERE ss.id = s.id
  AND s.rn = 1
  AND ss.prescribed_by != 'trainer'
  AND EXISTS (
    SELECT 1 FROM scheduled_sessions other
    WHERE other.client_id = s.client_id
      AND other.scheduled_date = s.scheduled_date
      AND other.session_id = s.session_id
      AND other.id != s.id
      AND other.prescribed_by = 'trainer'
  );

-- Borrar las filas loser (sus overrides + exercise_sets cascadean por FK).
DELETE FROM scheduled_sessions ss
WHERE ss.id IN (
  SELECT r.id
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY client_id, scheduled_date, session_id
        ORDER BY
          (SELECT COUNT(*) FROM exercise_logs el
             WHERE el.scheduled_session_id = scheduled_sessions.id) DESC,
          created_at ASC,
          id ASC
      ) AS rn
    FROM scheduled_sessions
    WHERE session_id IS NOT NULL
  ) r
  WHERE r.rn > 1
);

-- 1. (Skipped) session_id NOT NULL — producción tiene 10 filas legacy
--    con session_id NULL, 5 de las cuales tienen exercise_logs reales
--    adjuntos (38 logs en total). No las borramos para no perder
--    actividad histórica. La UNIQUE de la sección 3 trata NULLs como
--    distintos (default Postgres) así que no chocan entre sí. El RPC
--    de la sección 4 rechaza nuevos p_session_id NULL, así que no se
--    crearán más filas null desde acá en adelante. Una migración
--    futura puede limpiar las legacy nulls cuando el trainer pueda
--    asignarles session_id manualmente.

-- 2. Drop la UNIQUE vieja (idempotente).
ALTER TABLE scheduled_sessions
  DROP CONSTRAINT IF EXISTS scheduled_sessions_client_date_unique;

-- 3. Add la UNIQUE nueva.
ALTER TABLE scheduled_sessions
  ADD CONSTRAINT scheduled_sessions_client_date_session_unique
  UNIQUE (client_id, scheduled_date, session_id);

-- 4. Reescribir upsert_scheduled_session.
DROP FUNCTION IF EXISTS upsert_scheduled_session(
  TEXT, BIGINT, UUID, UUID, DATE, TEXT, TEXT, UUID, JSONB
);

CREATE OR REPLACE FUNCTION upsert_scheduled_session(
  p_tenant_host TEXT,
  p_client_id BIGINT,
  p_trainer_id UUID,
  p_session_id UUID,
  p_scheduled_date DATE,
  p_caller_role TEXT,
  p_status TEXT DEFAULT 'scheduled',
  p_client_program_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_id UUID;
  v_lock_key BIGINT;
BEGIN
  IF p_caller_role NOT IN ('trainer', 'client') THEN
    RAISE EXCEPTION 'p_caller_role inválido: %', p_caller_role
      USING ERRCODE = '22023';
  END IF;

  IF p_session_id IS NULL THEN
    RAISE EXCEPTION 'p_session_id no puede ser NULL'
      USING ERRCODE = '22023';
  END IF;

  v_lock_key := hashtextextended(
    p_client_id::text || ':' || p_scheduled_date::text || ':' || p_session_id::text, 0
  );
  PERFORM pg_advisory_xact_lock(v_lock_key);

  SELECT id INTO v_id
  FROM scheduled_sessions
  WHERE client_id = p_client_id
    AND scheduled_date = p_scheduled_date
    AND session_id = p_session_id
  FOR UPDATE;

  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  INSERT INTO scheduled_sessions(
    tenant_host, client_id, trainer_id, session_id,
    scheduled_date, status, client_program_id, metadata,
    prescribed_by
  )
  VALUES (
    p_tenant_host, p_client_id, p_trainer_id, p_session_id,
    p_scheduled_date,
    COALESCE(p_status, 'scheduled'),
    p_client_program_id,
    COALESCE(p_metadata, '{}'::jsonb),
    p_caller_role
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION upsert_scheduled_session(
  TEXT, BIGINT, UUID, UUID, DATE, TEXT, TEXT, UUID, JSONB
) TO anon, authenticated;

COMMIT;
