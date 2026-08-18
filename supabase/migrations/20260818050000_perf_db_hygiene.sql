-- Higiene de rendimiento de DB (diagnóstico 17-ago, patrón F del reporte):
-- (1) índices cubriendo las 26 foreign keys que no tenían (advisor
--     unindexed_foreign_keys) — aceleran joins y los chequeos de FK en
--     deletes/updates del padre;
-- (2) las 7 políticas RLS que re-evaluaban auth.uid() POR FILA pasan a
--     (select auth.uid()) — initplan una vez por query (advisor
--     auth_rls_initplan); semántica idéntica;
-- (3) políticas anon de trainers literalmente duplicadas (mismo rol, mismo
--     cmd, mismo USING/CHECK) — se conserva una por cmd (true OR true =
--     true, cero cambio de acceso);
-- (4) índice único duplicado en clients y tenants (advisor
--     duplicate_index) — verificado por dry-run que ningún FK depende de
--     los que se eliminan.
-- La consolidación de políticas permisivas NO duplicadas (nutrition_*,
-- clients) queda fuera a propósito: toca semántica y va en su propio paso.

-- (1) Índices para FKs sin cubrir -------------------------------------------

CREATE INDEX IF NOT EXISTS idx_client_diet_pdfs_client_id ON public.client_diet_pdfs (client_id);
CREATE INDEX IF NOT EXISTS idx_client_goal_presets_client_id ON public.client_goal_presets (client_id);
CREATE INDEX IF NOT EXISTS idx_client_measurements_tenant_host ON public.client_measurements (tenant_host);
CREATE INDEX IF NOT EXISTS idx_client_menu_choices_client_id ON public.client_menu_choices (client_id);
CREATE INDEX IF NOT EXISTS idx_client_menu_choices_cycle_id ON public.client_menu_choices (cycle_id);
CREATE INDEX IF NOT EXISTS idx_client_nutrition_goals_client_id ON public.client_nutrition_goals (client_id);
CREATE INDEX IF NOT EXISTS idx_client_nutrition_visibility_client_id ON public.client_nutrition_visibility (client_id);
CREATE INDEX IF NOT EXISTS idx_client_programs_program_id ON public.client_programs (program_id);
CREATE INDEX IF NOT EXISTS idx_clients_tenant ON public.clients (tenant);
CREATE INDEX IF NOT EXISTS idx_exercise_logs_tenant_host ON public.exercise_logs (tenant_host);
CREATE INDEX IF NOT EXISTS idx_exercise_video_reviews_tenant_host ON public.exercise_video_reviews (tenant_host);
CREATE INDEX IF NOT EXISTS idx_invitation_codes_used_by_trainer_id ON public.invitation_codes (used_by_trainer_id);
CREATE INDEX IF NOT EXISTS idx_meal_cycle_overrides_slot_id ON public.meal_cycle_overrides (slot_id);
CREATE INDEX IF NOT EXISTS idx_meal_cycles_trainer_id ON public.meal_cycles (trainer_id);
CREATE INDEX IF NOT EXISTS idx_meal_logs_option_id ON public.meal_logs (option_id);
CREATE INDEX IF NOT EXISTS idx_meal_slot_option_selections_option_id ON public.meal_slot_option_selections (option_id);
CREATE INDEX IF NOT EXISTS idx_microcycle_slots_session_id ON public.microcycle_slots (session_id);
CREATE INDEX IF NOT EXISTS idx_nutrition_option_selections_option_id ON public.nutrition_option_selections (option_id);
CREATE INDEX IF NOT EXISTS idx_personal_records_exercise_log_id ON public.personal_records (exercise_log_id);
CREATE INDEX IF NOT EXISTS idx_personal_records_tenant_host ON public.personal_records (tenant_host);
CREATE INDEX IF NOT EXISTS idx_recipe_folders_parent_id ON public.recipe_folders (parent_id);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_ingredient_id ON public.recipe_ingredients (ingredient_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_sessions_client_program_id ON public.scheduled_sessions (client_program_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_sessions_session_id ON public.scheduled_sessions (session_id);
CREATE INDEX IF NOT EXISTS idx_session_exercises_tenant_host ON public.session_exercises (tenant_host);
CREATE INDEX IF NOT EXISTS idx_trainer_chart_templates_trainer_id ON public.trainer_chart_templates (trainer_id);

-- (2) auth.uid() → (select auth.uid()) en las políticas flaggeadas ----------

ALTER POLICY admin_users_authenticated_select ON public.admin_users
    USING (id = (SELECT auth.uid()));
ALTER POLICY admin_users_authenticated_update ON public.admin_users
    USING (id = (SELECT auth.uid()))
    WITH CHECK (id = (SELECT auth.uid()));
ALTER POLICY "Allow admins create trainers" ON public.trainers
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.admin_users
        WHERE admin_users.id = (SELECT auth.uid())
          AND admin_users.status = 'active'));
ALTER POLICY "Allow admins read all trainers" ON public.trainers
    USING (EXISTS (
        SELECT 1 FROM public.admin_users
        WHERE admin_users.id = (SELECT auth.uid())
          AND admin_users.status = 'active'));
ALTER POLICY "Allow admins update trainers" ON public.trainers
    USING (EXISTS (
        SELECT 1 FROM public.admin_users
        WHERE admin_users.id = (SELECT auth.uid())
          AND admin_users.status = 'active'));
ALTER POLICY "Allow trainers read own data" ON public.trainers
    USING (id = (SELECT auth.uid()));
ALTER POLICY "Allow trainers update own data" ON public.trainers
    USING (id = (SELECT auth.uid()));

-- (3) Duplicados exactos de políticas anon en trainers ----------------------
-- Se conserva el set trainers_anon_* (select/insert/update/delete).

DROP POLICY IF EXISTS "Allow anon read trainers" ON public.trainers;
DROP POLICY IF EXISTS "Allow anon to read trainers" ON public.trainers;
DROP POLICY IF EXISTS "Allow anon insert trainers" ON public.trainers;
DROP POLICY IF EXISTS "Allow anon to update trainers" ON public.trainers;

-- (4) Índices únicos duplicados (queda la pkey en ambos casos) --------------
-- En prod los FKs dependen de la pkey y el drop es limpio; en local
-- históricamente quedaron colgando de clients_id_key. Si hay dependientes,
-- se conserva el índice y se avisa — es duplicado inofensivo, no vale una
-- recableada de FKs.

DO $$
BEGIN
    ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS clients_id_key;
EXCEPTION WHEN dependent_objects_still_exist THEN
    RAISE NOTICE 'clients_id_key conservado: hay FKs que dependen de él en este entorno';
END $$;

DO $$
BEGIN
    DROP INDEX IF EXISTS public.tenants_host_key;
EXCEPTION WHEN dependent_objects_still_exist THEN
    RAISE NOTICE 'tenants_host_key conservado: hay FKs que dependen de él en este entorno';
END $$;
