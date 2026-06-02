-- v2 de upsert_scheduled_session: ahora recibe quién está llamando
-- ('trainer' o 'client') y escribe scheduled_sessions.prescribed_by
-- según corresponda.
--
-- Reglas:
--   - INSERT (no existe row): prescribed_by = p_caller_role.
--   - UPDATE (row existe): conserva el prescribed_by previo. Es decir,
--     una row creada por el trainer NO se "downgradea" a 'client' por
--     el hecho de que el cliente loguee ejercicios en el mismo día —
--     sigue siendo prescripción del trainer aunque el cliente la
--     haya consumido. La RPC solo retorna el id; quien quiera cambiar
--     la prescripción tiene que llamar a la RPC del trainer
--     (replace_scheduled_session_overrides), que sí escribe 'trainer'.
--
-- Compatibilidad backwards: el parámetro p_caller_role tiene default
-- 'trainer' para no romper callers que aún no migraron. Una vez que
-- todos los callers pasan p_caller_role explícito, se puede quitar
-- el default en una migración futura.

CREATE OR REPLACE FUNCTION upsert_scheduled_session(
  p_tenant_host TEXT,
  p_client_id BIGINT,
  p_trainer_id UUID,
  p_session_id UUID,
  p_scheduled_date DATE,
  p_status TEXT DEFAULT 'scheduled',
  p_client_program_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL,
  p_caller_role TEXT DEFAULT 'trainer'
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
    -- Existe ya. No tocamos session_id, status, NI prescribed_by para
    -- no pisar un override del trainer si lo había.
    RETURN v_id;
  END IF;

  -- No existe → INSERT con prescribed_by según el caller.
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
  TEXT, BIGINT, UUID, UUID, DATE, TEXT, UUID, JSONB, TEXT
) TO anon, authenticated;
