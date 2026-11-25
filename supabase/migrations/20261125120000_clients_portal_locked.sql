-- Acceso al plan bajo llave (JC, nov): un cliente nuevo rellena el formulario
-- inicial y no ve entrenamiento ni nutrición hasta que el entrenador le da
-- acceso (tras la llamada de onboarding).
--
-- DEFAULT false: los clientes existentes siguen con acceso. Solo se crea
-- bloqueado un cliente nuevo cuando el entrenador tiene activo el formulario
-- inicial (app/api/clients/create).
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS portal_locked boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.clients.portal_locked IS
  'true = el cliente aún no ve entrenamiento ni nutrición; el entrenador lo desbloquea desde la ficha.';
