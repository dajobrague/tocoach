-- rename_tenant(old_host, new_host): renombra el slug/host de un tenant de forma
-- atómica y devuelve un resumen jsonb {repointed, tables}.
--
-- Por qué existe: `tenants.host` es la PK y el valor está copiado como FK en
-- 40+ tablas hijas, todas ON UPDATE NO ACTION, así que un UPDATE directo falla
-- con 23503 en cuanto el tenant tiene datos. Hasta hoy `save-domain` bloqueaba
-- el cambio ("contacta a soporte") y el rename se hacía a mano (danielmunoz
-- Aug 18, fuerzavital Sep 18). Esta función es ese script, parametrizado:
--   1. clona la fila de `tenants` bajo el host nuevo (misma fila, solo cambian
--      host/slug/updated_at y theme_json.meta.domain),
--   2. repuntea cada columna que guarda el host: todas las FKs a `tenants`
--      leídas del catálogo (así cubre tablas futuras) más las columnas de
--      texto que lo guardan sin FK,
--   3. asserta que no queda ninguna fila con el host viejo y solo entonces
--      borra la fila vieja (su ON DELETE CASCADE ya no tiene nada que tocar).
-- Cualquier RAISE revierte todo. No toca storage ni las URLs de media
-- (`exercises.image_url`, `uploaded_video_url`): el prefijo del path es solo
-- texto y las políticas de storage son por bucket.
--
-- ERRCODEs pensados para que la ruta los mapee:
--   22023 invalid_parameter_value  slug con formato inválido
--   P0002 no_data_found            el host viejo no existe
--   23505 unique_violation         el slug nuevo ya está en uso

CREATE OR REPLACE FUNCTION public.rename_tenant(p_old_host text, p_new_host text)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  r record;
  n bigint;
  leftover bigint;
  total bigint := 0;
  touched jsonb := '{}'::jsonb;
BEGIN
  IF p_new_host IS NULL OR p_new_host !~ '^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$' THEN
    RAISE EXCEPTION 'slug inválido: %', p_new_host USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF p_old_host = p_new_host THEN
    RETURN jsonb_build_object('repointed', 0, 'tables', touched);
  END IF;

  PERFORM 1 FROM tenants WHERE host = p_old_host FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'tenant % no existe', p_old_host USING ERRCODE = 'no_data_found';
  END IF;

  IF EXISTS (SELECT 1 FROM tenants WHERE host = p_new_host OR slug = p_new_host) THEN
    RAISE EXCEPTION 'slug % ya está en uso', p_new_host USING ERRCODE = 'unique_violation';
  END IF;

  -- 1. clon bajo el host nuevo
  INSERT INTO tenants
  SELECT (jsonb_populate_record(NULL::tenants, to_jsonb(t) || jsonb_build_object(
    'host', p_new_host,
    'slug', p_new_host,
    'updated_at', now(),
    'theme_json', CASE
      WHEN t.theme_json ? 'meta' THEN jsonb_set(t.theme_json, '{meta,domain}', to_jsonb(p_new_host))
      ELSE t.theme_json
    END
  ))).*
  FROM tenants t
  WHERE t.host = p_old_host;

  -- 2. repunteo: FKs a tenants (catálogo) + columnas de texto sin FK
  FOR r IN
    SELECT c.conrelid::regclass AS tbl,
           (SELECT a.attname FROM unnest(c.conkey) k
              JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k) AS col,
           array_length(c.conkey, 1) AS ncols
    FROM pg_constraint c
    WHERE c.contype = 'f' AND c.confrelid = 'public.tenants'::regclass
    UNION ALL
    SELECT v.tbl::regclass, v.col, 1 FROM (VALUES
      ('public.trainers', 'tenant_host'),
      ('public.tenant_events', 'host'),
      ('public.password_reset_otps', 'tenant_slug'),
      ('public.library_tags', 'tenant_host'),
      ('public.program_folders', 'tenant_host'),
      ('public.recipe_folders', 'tenant_host'),
      ('public.meal_cycle_templates', 'tenant_host'),
      ('public.chart_config_audit', 'tenant_host'),
      ('public.exercise_tags_split_audit', 'tenant_host')
    ) v(tbl, col)
  LOOP
    IF r.ncols <> 1 THEN
      RAISE EXCEPTION 'FK compuesta hacia tenants en %, rename_tenant no la soporta', r.tbl;
    END IF;

    EXECUTE format('UPDATE %s SET %I = $1 WHERE %I = $2', r.tbl, r.col, r.col)
      USING p_new_host, p_old_host;
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n > 0 THEN
      total := total + n;
      touched := touched || jsonb_build_object(r.tbl::text, n);
    END IF;

    EXECUTE format('SELECT count(*) FROM %s WHERE %I = $1', r.tbl, r.col)
      INTO leftover USING p_old_host;
    IF leftover > 0 THEN
      RAISE EXCEPTION 'quedan % filas con el host viejo en %.%', leftover, r.tbl, r.col;
    END IF;
  END LOOP;

  -- 3. fila vieja: todas las hijas ya apuntan al host nuevo (asertado arriba)
  DELETE FROM tenants WHERE host = p_old_host;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN
    RAISE EXCEPTION 'esperaba borrar 1 fila de tenants, borré %', n;
  END IF;

  RETURN jsonb_build_object('repointed', total, 'tables', touched);
END;
$$;

-- Solo el service role (rutas del servidor) puede invocarla.
REVOKE ALL ON FUNCTION public.rename_tenant(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rename_tenant(text, text) TO service_role;
