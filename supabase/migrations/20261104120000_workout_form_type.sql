-- Formulario post-entreno: tercer form_type 'workout' en el sistema de
-- formularios (plantilla por entrenador, respuesta enlazada a la sesión vía
-- form_responses.metadata.session_id). No siembra datos: cada entrenador lo
-- activa desde /trainer/settings/forms/workout.

begin;

alter table public.form_templates
  drop constraint if exists form_templates_form_type_check;
alter table public.form_templates
  add constraint form_templates_form_type_check
  check (form_type = any (array['checkins'::text, 'habits'::text, 'workout'::text]));

alter table public.client_form_configs
  drop constraint if exists client_form_configs_form_type_check;
alter table public.client_form_configs
  add constraint client_form_configs_form_type_check
  check (form_type = any (array['checkins'::text, 'habits'::text, 'workout'::text]));

alter table public.form_responses
  drop constraint if exists form_responses_form_type_check;
alter table public.form_responses
  add constraint form_responses_form_type_check
  check (form_type = any (array['checkins'::text, 'habits'::text, 'workout'::text]));

commit;
