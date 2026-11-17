-- Formulario inicial: cuarto form_type 'intake' (plantilla por entrenador,
-- sin copia por cliente, como el post-entreno). No siembra datos: cada
-- entrenador lo activa desde /trainer/settings/forms/intake.
--
-- UNA respuesta por cliente: índice único parcial. El UNIQUE de 5 columnas
-- (por día) sigue siendo el objetivo ON CONFLICT de los upserts; para intake
-- la app reutiliza la fecha de la respuesta existente, así que el upsert cae
-- siempre sobre la misma fila. Este índice solo frena carreras/duplicados.
--
-- Idempotente: se puede re-aplicar. Seguro antes del código (solo amplía).

begin;

alter table public.form_templates
  drop constraint if exists form_templates_form_type_check;
alter table public.form_templates
  add constraint form_templates_form_type_check
  check (form_type = any (array['checkins'::text, 'habits'::text, 'workout'::text, 'intake'::text]));

alter table public.client_form_configs
  drop constraint if exists client_form_configs_form_type_check;
alter table public.client_form_configs
  add constraint client_form_configs_form_type_check
  check (form_type = any (array['checkins'::text, 'habits'::text, 'workout'::text, 'intake'::text]));

alter table public.form_responses
  drop constraint if exists form_responses_form_type_check;
alter table public.form_responses
  add constraint form_responses_form_type_check
  check (form_type = any (array['checkins'::text, 'habits'::text, 'workout'::text, 'intake'::text]));

create unique index if not exists form_responses_one_intake_per_client
  on public.form_responses (tenant_host, client_id)
  where form_type = 'intake';

commit;
