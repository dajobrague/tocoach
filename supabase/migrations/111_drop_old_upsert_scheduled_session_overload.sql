-- Endurecimiento de upsert_scheduled_session post-109:
--
-- 1. DROP del overload viejo de 8 args (sin p_caller_role). Convivían:
--      upsert_scheduled_session(text, bigint, uuid, uuid, date, text, uuid, jsonb)
--      upsert_scheduled_session(text, bigint, uuid, uuid, date, text, uuid, jsonb, text)
--    Un caller que olvidara p_caller_role caía en la vieja y la columna
--    quedaba con su default 'trainer'. Eso reabriría el bug que estamos
--    cerrando: filas creadas por el cliente marcadas como recomendación
--    del trainer.
--
-- 2. Volver a definir la versión de 9 args quitando el DEFAULT 'trainer'
--    de p_caller_role. Sin default, un caller que olvide pasarlo falla
--    con un error de invocación en vez de silenciosamente registrar
--    'trainer'. Audit confirma que los 2 callers actuales pasan el
--    parámetro:
--      - app/api/clients/[clientId]/exercise-logs/route.ts → 'client'
--      - app/api/clients/[clientId]/scheduled-sessions/route.ts → 'client'
--    El RPC del trainer (replace_scheduled_session_overrides) escribe
--    'trainer' por su cuenta y no usa esta función.

DROP FUNCTION IF EXISTS upsert_scheduled_session(
  TEXT, BIGINT, UUID, UUID, DATE, TEXT, UUID, JSONB
);

DROP FUNCTION IF EXISTS upsert_scheduled_session(
  TEXT, BIGINT, UUID, UUID, DATE, TEXT, UUID, JSONB, TEXT
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
