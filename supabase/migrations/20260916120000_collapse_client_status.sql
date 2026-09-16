-- Sep 2026: el estado de cliente pasa a ser sólo Activo / Inactivo.
--
-- "Onboarding Completado" ya se trataba como activo en login, recuperación
-- de contraseña, notificaciones y programación de formularios, así que pasa
-- a Activo. Los estados pendientes/pausados de pago nunca podían iniciar
-- sesión, así que pasan a Inactivo (mismo comportamiento, etiqueta clara).
--
-- El enum client_status conserva los valores antiguos: Postgres no permite
-- eliminar valores de un enum sin recrear el tipo, y no hace falta.
-- Aplicar a mano en el SQL editor de Supabase (patrón habitual del proyecto).

UPDATE public.clients
SET status = 'Activo'
WHERE status = 'Onboarding Completado';

UPDATE public.clients
SET status = 'Inactivo'
WHERE status IN (
  'Programación Inicial Pendiente',
  'Suscripción a Pagos Pendiente',
  'Pagos Pausados'
);
