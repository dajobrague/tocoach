-- Formulario post-entreno: tercer form_type 'workout' en el sistema de
-- formularios (plantilla por entrenador). No siembra datos: cada entrenador
-- lo activa desde /trainer/settings/forms/workout.
--
-- Unicidad: check-ins y hábitos siguen siendo UNA respuesta por
-- cliente/tipo/día; el post-entreno es UNA por sesión programada (dos
-- sesiones el mismo día → dos respuestas). Se consigue con una columna real
-- `scheduled_session_id` (NULL salvo en 'workout') y un único UNIQUE
-- NULLS NOT DISTINCT de 5 columnas, que sigue sirviendo de objetivo
-- ON CONFLICT para los upserts (un índice parcial no lo serviría).
--
-- DESPLIEGUE: los upserts de la app pasan a
-- onConflict "tenant_host,client_id,form_type,response_date,scheduled_session_id".
-- Migración y código deben salir juntos: con uno sin el otro, el envío de
-- check-ins/hábitos falla (no hay UNIQUE que case con el ON CONFLICT).
--
-- Idempotente: se puede re-aplicar.

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

-- Sesión programada a la que pertenece una respuesta post-entreno.
alter table public.form_responses
  add column if not exists scheduled_session_id uuid
  references public.scheduled_sessions (id) on delete cascade;

-- Por si hubiera filas 'workout' previas sin la columna (enlace en metadata).
update public.form_responses
  set scheduled_session_id = (metadata ->> 'scheduled_session_id')::uuid
  where form_type = 'workout'
    and scheduled_session_id is null
    and metadata ->> 'scheduled_session_id' ~ '^[0-9a-f-]{36}$';

-- Solo 'workout' lleva sesión, y siempre la lleva.
alter table public.form_responses
  drop constraint if exists form_responses_workout_session_check;
alter table public.form_responses
  add constraint form_responses_workout_session_check
  check ((form_type = 'workout') = (scheduled_session_id is not null));

alter table public.form_responses
  drop constraint if exists form_responses_unique_per_day;
alter table public.form_responses
  drop constraint if exists form_responses_unique_per_day_or_session;
alter table public.form_responses
  add constraint form_responses_unique_per_day_or_session
  unique nulls not distinct
  (tenant_host, client_id, form_type, response_date, scheduled_session_id);

commit;
