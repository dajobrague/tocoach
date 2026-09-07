-- Deuda (2026-09-07), limpieza tras revoke_anon_table_access:
-- 1. Las políticas `USING (true)` para anon/authenticated/public son inertes
--    (esos roles no tienen grants) pero confunden a quien lea pg_policies y
--    al advisor. Se eliminan todas salvo las dos de Realtime, que sí gobiernan
--    el SELECT de `authenticated` en messages / notifications.
-- 2. Advisor de Supabase "function_search_path_mutable": fijar search_path en
--    las funciones de public para que no dependan del search_path del caller
--    (vector clásico de escalada con SECURITY DEFINER).

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (qual = 'true' OR (qual IS NULL AND with_check = 'true'))
      AND roles && ARRAY['anon','authenticated','public']::name[]
      AND policyname NOT IN ('messages_realtime_select', 'notifications_realtime_select')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

ALTER FUNCTION public.auto_confirm_admin_email() SET search_path = public;
ALTER FUNCTION public.auto_confirm_trainer_email() SET search_path = public;
ALTER FUNCTION public.delete_auth_user_on_admin_delete() SET search_path = public;
ALTER FUNCTION public.get_client_checkin_streak(bigint) SET search_path = public;
ALTER FUNCTION public.get_or_create_client_form_config(bigint, text, text) SET search_path = public;
ALTER FUNCTION public.get_tenant_host_for_client(bigint) SET search_path = public;
ALTER FUNCTION public.get_trainer_deletion_impact(uuid) SET search_path = public;
ALTER FUNCTION public.library_ensure_tags(text, text, text[]) SET search_path = public;
ALTER FUNCTION public.library_retag(text[], text, text) SET search_path = public;
ALTER FUNCTION public.library_tags_with_usage(text, text) SET search_path = public;
ALTER FUNCTION public.replace_exercise_tag(text, text, text) SET search_path = public;
ALTER FUNCTION public.replace_program_tag(text, text, text) SET search_path = public;
ALTER FUNCTION public.replace_recipe_tag(text, text, text) SET search_path = public;
ALTER FUNCTION public.replace_scheduled_session_overrides(text, bigint, uuid, date, uuid, jsonb, jsonb) SET search_path = public;
ALTER FUNCTION public.set_updated_at() SET search_path = public;
ALTER FUNCTION public.update_forms_updated_at() SET search_path = public;
ALTER FUNCTION public.update_updated_at_column() SET search_path = public;
ALTER FUNCTION public.upsert_scheduled_session(text, bigint, uuid, uuid, date, text, text, uuid, jsonb) SET search_path = public;
