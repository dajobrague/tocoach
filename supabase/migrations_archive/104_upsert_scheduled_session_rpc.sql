-- RPC atómica para crear o devolver una scheduled_sessions row.
--
-- Reemplaza el patrón "SELECT ... maybeSingle + INSERT si no existe" que
-- usan 3 callers diferentes hoy:
--   - app/api/clients/[clientId]/exercise-logs/route.ts (cliente loguea)
--   - app/api/clients/[clientId]/scheduled-sessions/route.ts (trainer
--     programa manual)
--   - lib/services/program-service.ts:scheduleSession (cron / batch)
--
-- El patrón antiguo crea duplicados por dos razones:
--
-- 1) Race condition: dos requests concurrentes para el mismo
--    (client, date) ven el SELECT vacío y ambos hacen INSERT.
--    Auditoría 2026-05-12: 130 pares duplicados en prod, ~15 por día
--    creándose.
--
-- 2) En exercise-logs el lookup incluye session_id; si el trainer
--    cambió la sesión vía override, el lookup no encuentra y se crea
--    un duplicado con la session_id vieja que el cliente tenía
--    cacheada.
--
-- Esta RPC usa pg_advisory_xact_lock keyed por (client, date), idéntico
-- al patrón de replace_scheduled_session_overrides (095/098/099/101).
-- Garantiza serialización: bajo concurrencia, solo una request gana,
-- las demás retornan el id existente.
--
-- Behavior:
--   - Si existe row por (client_id, scheduled_date): retorna su id,
--     opcionalmente update session_id/status si los args son no-NULL
--     y la fila está abierta (sin logs aún).
--   - Si no existe: INSERT y retorna el nuevo id.
--
-- Returns: UUID (id de la row, sea existente o nueva).

CREATE OR REPLACE FUNCTION upsert_scheduled_session(
  p_tenant_host TEXT,
  p_client_id BIGINT,
  p_trainer_id UUID,
  p_session_id UUID,
  p_scheduled_date DATE,
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
  v_lock_key := hashtextextended(
    p_client_id::text || ':' || p_scheduled_date::text, 0
  );
  PERFORM pg_advisory_xact_lock(v_lock_key);

  SELECT id INTO v_id
  FROM scheduled_sessions
  WHERE client_id = p_client_id
    AND scheduled_date = p_scheduled_date
  FOR UPDATE;

  IF v_id IS NOT NULL THEN
    -- Existe ya. No tocamos session_id ni status para no pisar el
    -- override del trainer si lo había. El caller decide en su
    -- post-procesamiento si quiere update.
    RETURN v_id;
  END IF;

  -- No existe → INSERT.
  INSERT INTO scheduled_sessions(
    tenant_host, client_id, trainer_id, session_id,
    scheduled_date, status, client_program_id, metadata
  )
  VALUES (
    p_tenant_host, p_client_id, p_trainer_id, p_session_id,
    p_scheduled_date,
    COALESCE(p_status, 'scheduled'),
    p_client_program_id,
    COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION upsert_scheduled_session(
  TEXT, BIGINT, UUID, UUID, DATE, TEXT, UUID, JSONB
) TO anon, authenticated;
