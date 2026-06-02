-- Migración 081: Flag "auto aplicar plantilla a clientes nuevos" (Pedido 2 - Formularios).
--
-- Contexto: hasta ahora el trainer editaba la plantilla (form_templates) pero
-- los clientes existentes y los nuevos NO recibían automáticamente esas
-- preguntas/horario — dependía de la creación "lazy" que ocurría al primer
-- GET de /api/forms/configs/[clientId]. El feedback pide que:
--   (a) el trainer active explícitamente "aplicar a nuevos clientes" por
--       plantilla, y cuando esté activo, los clientes recién creados reciban
--       el form_config ya sembrado (preguntas + horario) sin necesidad de
--       abrir su perfil.
--   (b) el comportamiento actual (default OFF) siga intacto para no
--       sorprender a ningún tenant existente.
--
-- Diseño:
--  - Campo nuevo booleano, NOT NULL con DEFAULT false → aditivo, no rompe
--    ninguna plantilla existente. Tenants que nunca lo activen mantienen la
--    creación lazy como hoy.
--  - Por tenant+form_type ya existe UNIQUE(tenant_host, form_type) en
--    form_templates — una sola plantilla por tipo, no cambia.
--  - NO se propaga a clientes existentes por ningún trigger; la aplicación
--    a existentes sigue siendo SOLO vía acción explícita del trainer
--    (endpoint apply-template con doble confirmación en UI).
--
-- Aditiva, IF NOT EXISTS, no reescribe datos, no toca clientes actuales.

ALTER TABLE form_templates
  ADD COLUMN IF NOT EXISTS auto_apply_to_new_clients BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN form_templates.auto_apply_to_new_clients IS
  'When true, newly created clients for this tenant receive a client_form_configs row seeded from this template (questions_config + default_schedule) at creation time. Does NOT propagate to existing clients.';
