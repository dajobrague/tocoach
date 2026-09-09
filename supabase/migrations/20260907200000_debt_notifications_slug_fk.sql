-- Deuda (2026-09-07): notifications.tenant_slug guardaba SLUG desde chat /
-- vídeo (6 escritores) y HOST desde los recordatorios de formularios (2), con
-- una FK que apuntaba a tenants(host). Hoy host == slug en los 42 tenants,
-- así que nada fallaba; en cuanto un tenant tenga host <> slug, el chat
-- rompería con 23503 y la campana del cliente (que filtra por slug) dejaría
-- de ver los recordatorios. Decisión: la columna es SLUG, como dice su nombre
-- y como leen los clientes. La FK pasa a tenants(slug); los dos escritores de
-- forms/notifications/create escriben slug (código de la misma PR).
-- Verificado en prod antes de escribir esto: tenants.slug sin duplicados ni
-- nulos; 0 filas de notifications cuyo tenant_slug no sea también un slug.

-- 1. slug debe ser clave única para poder ser referenciado.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conrelid = 'public.tenants'::regclass AND conname = 'tenants_slug_key'
  ) THEN
    ALTER TABLE public.tenants ADD CONSTRAINT tenants_slug_key UNIQUE (slug);
  END IF;
END $$;

-- 2. Guardia: ninguna fila puede quedar huérfana bajo la FK nueva.
DO $$
DECLARE orphans BIGINT;
BEGIN
  SELECT count(*) INTO orphans
  FROM public.notifications n
  LEFT JOIN public.tenants t ON t.slug = n.tenant_slug
  WHERE t.slug IS NULL;
  IF orphans > 0 THEN
    RAISE EXCEPTION 'notifications: % filas cuyo tenant_slug no es un tenants.slug; corrige antes de cambiar la FK', orphans;
  END IF;
END $$;

-- 3. FK → tenants(slug). Se localiza la FK actual por definición, no por nombre.
DO $$
DECLARE fk TEXT;
BEGIN
  SELECT conname INTO fk FROM pg_constraint
  WHERE conrelid = 'public.notifications'::regclass AND contype = 'f'
    AND pg_get_constraintdef(oid) LIKE 'FOREIGN KEY (tenant_slug) REFERENCES tenants(host)%';
  IF fk IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.notifications DROP CONSTRAINT %I', fk);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.notifications'::regclass AND contype = 'f'
      AND pg_get_constraintdef(oid) LIKE 'FOREIGN KEY (tenant_slug) REFERENCES tenants(slug)%'
  ) THEN
    ALTER TABLE public.notifications
      ADD CONSTRAINT notifications_tenant_slug_fkey
      FOREIGN KEY (tenant_slug) REFERENCES public.tenants(slug) ON DELETE CASCADE;
  END IF;
END $$;
-- messages.tenant_slug sigue guardando HOST (FK a tenants(host), ambos
-- escritores, política Realtime): consistente aunque el nombre despiste.
