


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."client_status" AS ENUM (
    'Onboarding Completado',
    'Programación Inicial Pendiente',
    'Suscripción a Pagos Pendiente',
    'Activo',
    'Pagos Pausados',
    'Inactivo'
);


ALTER TYPE "public"."client_status" OWNER TO "postgres";


CREATE TYPE "public"."message_sender_type" AS ENUM (
    'client',
    'trainer'
);


ALTER TYPE "public"."message_sender_type" OWNER TO "postgres";


CREATE TYPE "public"."notification_type" AS ENUM (
    'workout_assigned',
    'message',
    'check_in_reminder',
    'measurement_due',
    'achievement',
    'program_updated',
    'session_scheduled',
    'form_weekly_available',
    'form_weekly_reminder',
    'form_weekly_expiring',
    'form_weekly_expired',
    'form_daily_available',
    'form_daily_reminder'
);


ALTER TYPE "public"."notification_type" OWNER TO "postgres";


CREATE TYPE "public"."tenant_status" AS ENUM (
    'active',
    'inactive'
);


ALTER TYPE "public"."tenant_status" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auto_confirm_admin_email"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$ BEGIN -- If this user is being added to admin_users, confirm their email in auth.users
  -- confirmed_at will be automatically set by Supabase when email_confirmed_at is set
UPDATE auth.users
SET email_confirmed_at = COALESCE(email_confirmed_at, NOW())
WHERE id = NEW.id
  AND email_confirmed_at IS NULL;
RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."auto_confirm_admin_email"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auto_confirm_trainer_email"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$ 
BEGIN 
  UPDATE auth.users
  SET email_confirmed_at = COALESCE(email_confirmed_at, NOW())
  WHERE id = NEW.id
    AND email_confirmed_at IS NULL;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."auto_confirm_trainer_email"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_otp_rate_limit"("p_email" "text", "p_user_type" "text", "p_window_minutes" integer DEFAULT 15, "p_max_requests" integer DEFAULT 3) RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  SELECT CASE
    WHEN p_user_type IS NULL
      OR p_user_type NOT IN ('trainer', 'client') THEN false
    ELSE (
      SELECT COUNT(*)::INTEGER
      FROM password_reset_otps
      WHERE lower(trim(email)) = lower(trim(p_email))
        AND user_type = p_user_type
        AND created_at > now() - (p_window_minutes * interval '1 minute')
    ) < p_max_requests
  END;
$$;


ALTER FUNCTION "public"."check_otp_rate_limit"("p_email" "text", "p_user_type" "text", "p_window_minutes" integer, "p_max_requests" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."check_otp_rate_limit"("p_email" "text", "p_user_type" "text", "p_window_minutes" integer, "p_max_requests" integer) IS 'Counts OTP rows in the sliding window for email+user_type; returns TRUE if count < p_max_requests.';



CREATE OR REPLACE FUNCTION "public"."cleanup_expired_otps"() RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  DELETE FROM password_reset_otps
  WHERE expires_at < now() - interval '1 hour';
$$;


ALTER FUNCTION "public"."cleanup_expired_otps"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."cleanup_expired_otps"() IS 'Deletes expired OTP rows after a 1 hour grace period. Runs with definer rights; schedule via cron or run as privileged role.';



CREATE OR REPLACE FUNCTION "public"."delete_auth_user_on_admin_delete"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Delete the corresponding auth.users record
  DELETE FROM auth.users WHERE id = OLD.id;
  RETURN OLD;
END;
$$;


ALTER FUNCTION "public"."delete_auth_user_on_admin_delete"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_checkin_schedule"("p_config_schedule" "jsonb", "p_template_schedule" "jsonb") RETURNS "jsonb"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
    SELECT COALESCE(
        p_config_schedule,
        p_template_schedule,
        '{"frequency":"weekly","times_per_week":1,"days_of_week":[1],"time":"12:00","timezone":"Europe/Madrid","custom_name":"Checkin semanal","grace_period_hours":48,"enabled":true}'::jsonb
    );
$$;


ALTER FUNCTION "public"."get_checkin_schedule"("p_config_schedule" "jsonb", "p_template_schedule" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_client_checkin_streak"("p_client_id" bigint) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE v_streak INTEGER := 0;
v_current_date DATE := CURRENT_DATE;
BEGIN -- Count consecutive days backwards from today
WHILE EXISTS (
    SELECT 1
    FROM client_checkins
    WHERE client_id = p_client_id
        AND checkin_date = v_current_date
) LOOP v_streak := v_streak + 1;
v_current_date := v_current_date - INTERVAL '1 day';
END LOOP;
RETURN v_streak;
END;
$$;


ALTER FUNCTION "public"."get_client_checkin_streak"("p_client_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_or_create_client_form_config"("p_client_id" bigint, "p_form_type" "text", "p_tenant_host" "text") RETURNS TABLE("id" "uuid", "tenant_host" "text", "client_id" bigint, "form_type" "text", "questions_config" "jsonb", "uses_template" boolean, "template_id" "uuid", "created_at" timestamp with time zone, "updated_at" timestamp with time zone)
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_config_exists BOOLEAN;
    v_template_id UUID;
    v_template_config JSONB;
BEGIN
    -- Check if config already exists
    SELECT EXISTS (
        SELECT 1 FROM client_form_configs 
        WHERE client_form_configs.client_id = p_client_id 
        AND client_form_configs.form_type = p_form_type
    ) INTO v_config_exists;

    -- If config exists, return it
    IF v_config_exists THEN
        RETURN QUERY
        SELECT 
            cfc.id,
            cfc.tenant_host,
            cfc.client_id,
            cfc.form_type,
            cfc.questions_config,
            cfc.uses_template,
            cfc.template_id,
            cfc.created_at,
            cfc.updated_at
        FROM client_form_configs cfc
        WHERE cfc.client_id = p_client_id 
        AND cfc.form_type = p_form_type;
    ELSE
        -- Get template for this form type and tenant
        SELECT ft.id, ft.questions_config
        INTO v_template_id, v_template_config
        FROM form_templates ft
        WHERE ft.tenant_host = p_tenant_host
        AND ft.form_type = p_form_type
        AND ft.is_active = true
        LIMIT 1;

        -- Create new config from template
        IF v_template_id IS NOT NULL THEN
            RETURN QUERY
            INSERT INTO client_form_configs (
                tenant_host,
                client_id,
                form_type,
                questions_config,
                uses_template,
                template_id
            ) VALUES (
                p_tenant_host,
                p_client_id,
                p_form_type,
                v_template_config,
                true,
                v_template_id
            )
            RETURNING 
                client_form_configs.id,
                client_form_configs.tenant_host,
                client_form_configs.client_id,
                client_form_configs.form_type,
                client_form_configs.questions_config,
                client_form_configs.uses_template,
                client_form_configs.template_id,
                client_form_configs.created_at,
                client_form_configs.updated_at;
        END IF;
    END IF;
END;
$$;


ALTER FUNCTION "public"."get_or_create_client_form_config"("p_client_id" bigint, "p_form_type" "text", "p_tenant_host" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_tenant_host_for_client"("p_client_id" bigint) RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT t.host
  FROM clients c
  JOIN tenants t ON t.trainer_id = c.tenant::uuid
  WHERE c.id = p_client_id
  LIMIT 1;
$$;


ALTER FUNCTION "public"."get_tenant_host_for_client"("p_client_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_trainer_deletion_impact"("trainer_uuid" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE result JSON;
v_clients_count INT := 0;
v_programs_count INT := 0;
v_sessions_count INT := 0;
v_exercises_count INT := 0;
v_nutrition_count INT := 0;
v_messages_count INT := 0;
v_tenants_count INT := 0;
BEGIN -- Test each count separately to isolate the error
BEGIN
SELECT COUNT(*) INTO v_tenants_count
FROM tenants
WHERE trainer_id = trainer_uuid;
EXCEPTION
WHEN OTHERS THEN v_tenants_count := -1;
END;
BEGIN
SELECT COUNT(*) INTO v_clients_count
FROM clients c
    JOIN tenants t ON c.tenant = t.host
WHERE t.trainer_id = trainer_uuid;
EXCEPTION
WHEN OTHERS THEN v_clients_count := -1;
END;
BEGIN
SELECT COUNT(*) INTO v_programs_count
FROM programs
WHERE trainer_id = trainer_uuid;
EXCEPTION
WHEN OTHERS THEN v_programs_count := -1;
END;
BEGIN
SELECT COUNT(*) INTO v_sessions_count
FROM sessions
WHERE trainer_id = trainer_uuid;
EXCEPTION
WHEN OTHERS THEN v_sessions_count := -1;
END;
BEGIN
SELECT COUNT(*) INTO v_exercises_count
FROM exercises
WHERE trainer_id = trainer_uuid;
EXCEPTION
WHEN OTHERS THEN v_exercises_count := -1;
END;
BEGIN
SELECT COUNT(*) INTO v_nutrition_count
FROM nutrition_plans
WHERE trainer_id = trainer_uuid;
EXCEPTION
WHEN OTHERS THEN v_nutrition_count := -1;
END;
BEGIN
SELECT COUNT(*) INTO v_messages_count
FROM messages
WHERE sender_id = trainer_uuid
    OR receiver_id = trainer_uuid;
EXCEPTION
WHEN OTHERS THEN v_messages_count := -1;
END;
SELECT json_build_object(
        'clients_count',
        v_clients_count,
        'programs_count',
        v_programs_count,
        'sessions_count',
        v_sessions_count,
        'exercises_count',
        v_exercises_count,
        'nutrition_plans_count',
        v_nutrition_count,
        'messages_count',
        v_messages_count,
        'tenants_count',
        v_tenants_count
    ) INTO result;
RETURN result;
END;
$$;


ALTER FUNCTION "public"."get_trainer_deletion_impact"("trainer_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."replace_scheduled_session_overrides"("p_tenant_host" "text", "p_client_id" bigint, "p_trainer_id" "uuid", "p_scheduled_date" "date", "p_session_id" "uuid", "p_exercises" "jsonb", "p_sets" "jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_scheduled_session_id UUID;
    v_lock_key BIGINT;
    v_ex_orders INT[];
    v_set_orders INT[];
    v_missing INT[];
BEGIN
    IF p_session_id IS NULL THEN
        RAISE EXCEPTION 'p_session_id no puede ser NULL'
            USING ERRCODE = '22023';
    END IF;

    IF jsonb_array_length(p_sets) > 0 THEN
        SELECT array_agg(DISTINCT (e->>'exerciseOrder')::INT)
        INTO v_ex_orders
        FROM jsonb_array_elements(p_exercises) AS e;

        SELECT array_agg(DISTINCT (s->>'exerciseOrder')::INT)
        INTO v_set_orders
        FROM jsonb_array_elements(p_sets) AS s;

        SELECT array_agg(o) INTO v_missing
        FROM unnest(COALESCE(v_set_orders, ARRAY[]::INT[])) AS o
        WHERE NOT (o = ANY(COALESCE(v_ex_orders, ARRAY[]::INT[])));

        IF v_missing IS NOT NULL AND array_length(v_missing, 1) > 0 THEN
            RAISE EXCEPTION
                'replace_scheduled_session_overrides: p_sets refers to exerciseOrder(s) % not present in p_exercises',
                v_missing
                USING ERRCODE = 'check_violation';
        END IF;
    END IF;

    v_lock_key := hashtextextended(
        p_client_id::text || ':' || p_scheduled_date::text, 0
    );
    PERFORM pg_advisory_xact_lock(v_lock_key);

    SELECT id INTO v_scheduled_session_id
    FROM scheduled_sessions
    WHERE client_id = p_client_id
      AND scheduled_date = p_scheduled_date
      AND session_id = p_session_id
    FOR UPDATE;

    IF v_scheduled_session_id IS NULL THEN
        INSERT INTO scheduled_sessions(
            tenant_host, client_id, trainer_id, session_id,
            scheduled_date, status, prescribed_by
        )
        VALUES (
            p_tenant_host, p_client_id, p_trainer_id, p_session_id,
            p_scheduled_date, 'scheduled', 'trainer'
        )
        RETURNING id INTO v_scheduled_session_id;
    ELSE
        UPDATE scheduled_sessions
        SET status = 'scheduled',
            prescribed_by = 'trainer',
            updated_at = NOW()
        WHERE id = v_scheduled_session_id;
    END IF;

    -- Reconciliar stale trainer pins.
    -- FOR UPDATE en `stale` lockea las filas durante toda la transacción
    -- del RPC. Concurrent inserts a exercise_logs apuntando a estas
    -- filas bloquean en el FK check hasta nuestro commit.
    WITH stale AS (
        SELECT ss.id,
               EXISTS(
                 SELECT 1 FROM exercise_logs el
                 WHERE el.scheduled_session_id = ss.id
               ) AS has_logs
        FROM scheduled_sessions ss
        WHERE ss.client_id = p_client_id
          AND ss.scheduled_date = p_scheduled_date
          AND ss.prescribed_by = 'trainer'
          AND ss.id != v_scheduled_session_id
        FOR UPDATE
    ),
    demoted AS (
        UPDATE scheduled_sessions ss
        SET prescribed_by = 'client',
            updated_at = NOW()
        FROM stale
        WHERE ss.id = stale.id AND stale.has_logs = true
        RETURNING ss.id
    )
    DELETE FROM scheduled_sessions ss
    USING stale
    WHERE ss.id = stale.id AND stale.has_logs = false;

    DELETE FROM scheduled_session_exercises
    WHERE scheduled_session_id = v_scheduled_session_id;

    IF jsonb_array_length(p_exercises) > 0 THEN
        INSERT INTO scheduled_session_exercises(
            tenant_host, scheduled_session_id, exercise_id, exercise_order,
            sets, reps, weight_kg,
            duration_seconds, distance_meters, rest_seconds, notes
        )
        SELECT
            p_tenant_host,
            v_scheduled_session_id,
            (e->>'exerciseId')::UUID,
            (e->>'exerciseOrder')::INT,
            NULLIF(e->>'sets', '')::INT,
            NULLIF(e->>'reps', ''),
            NULLIF(e->>'weightKg', '')::DECIMAL,
            NULLIF(e->>'durationSeconds', '')::INT,
            NULLIF(e->>'distanceMeters', '')::DECIMAL,
            NULLIF(e->>'restSeconds', '')::INT,
            NULLIF(e->>'notes', '')
        FROM jsonb_array_elements(p_exercises) AS e;
    END IF;

    IF jsonb_array_length(p_sets) > 0 THEN
        INSERT INTO scheduled_session_exercise_sets(
            tenant_host, scheduled_session_exercise_id,
            set_number, reps, weight_kg
        )
        SELECT
            p_tenant_host,
            sse.id,
            (s->>'setNumber')::INT,
            NULLIF(s->>'reps', ''),
            NULLIF(s->>'weightKg', '')::DECIMAL
        FROM jsonb_array_elements(p_sets) AS s
        JOIN scheduled_session_exercises sse
            ON sse.scheduled_session_id = v_scheduled_session_id
           AND sse.exercise_order = (s->>'exerciseOrder')::INT;
    END IF;

    RETURN v_scheduled_session_id;
END;
$$;


ALTER FUNCTION "public"."replace_scheduled_session_overrides"("p_tenant_host" "text", "p_client_id" bigint, "p_trainer_id" "uuid", "p_scheduled_date" "date", "p_session_id" "uuid", "p_exercises" "jsonb", "p_sets" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_forms_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$ BEGIN NEW.updated_at = NOW();
RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_forms_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_scheduled_session"("p_tenant_host" "text", "p_client_id" bigint, "p_trainer_id" "uuid", "p_session_id" "uuid", "p_scheduled_date" "date", "p_caller_role" "text", "p_status" "text" DEFAULT 'scheduled'::"text", "p_client_program_id" "uuid" DEFAULT NULL::"uuid", "p_metadata" "jsonb" DEFAULT NULL::"jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_id UUID;
  v_lock_key BIGINT;
BEGIN
  IF p_caller_role NOT IN ('trainer', 'client') THEN
    RAISE EXCEPTION 'p_caller_role inválido: %', p_caller_role
      USING ERRCODE = '22023';
  END IF;

  IF p_session_id IS NULL THEN
    RAISE EXCEPTION 'p_session_id no puede ser NULL'
      USING ERRCODE = '22023';
  END IF;

  v_lock_key := hashtextextended(
    p_client_id::text || ':' || p_scheduled_date::text || ':' || p_session_id::text, 0
  );
  PERFORM pg_advisory_xact_lock(v_lock_key);

  SELECT id INTO v_id
  FROM scheduled_sessions
  WHERE client_id = p_client_id
    AND scheduled_date = p_scheduled_date
    AND session_id = p_session_id
  FOR UPDATE;

  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  INSERT INTO scheduled_sessions(
    tenant_host, client_id, trainer_id, session_id,
    scheduled_date, status, client_program_id, metadata,
    prescribed_by
  )
  VALUES (
    p_tenant_host, p_client_id, p_trainer_id, p_session_id,
    p_scheduled_date,
    COALESCE(p_status, 'scheduled'),
    p_client_program_id,
    COALESCE(p_metadata, '{}'::jsonb),
    p_caller_role
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;


ALTER FUNCTION "public"."upsert_scheduled_session"("p_tenant_host" "text", "p_client_id" bigint, "p_trainer_id" "uuid", "p_session_id" "uuid", "p_scheduled_date" "date", "p_caller_role" "text", "p_status" "text", "p_client_program_id" "uuid", "p_metadata" "jsonb") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."admin_users" (
    "id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "full_name" "text" NOT NULL,
    "role" "text" DEFAULT 'super_admin'::"text",
    "created_at" timestamp without time zone DEFAULT "now"(),
    "last_login_at" timestamp without time zone,
    "status" "text" DEFAULT 'active'::"text",
    "password_changed_at" timestamp without time zone,
    CONSTRAINT "admin_users_role_check" CHECK (("role" = ANY (ARRAY['super_admin'::"text", 'admin'::"text"]))),
    CONSTRAINT "admin_users_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'inactive'::"text"])))
);


ALTER TABLE "public"."admin_users" OWNER TO "postgres";


COMMENT ON TABLE "public"."admin_users" IS 'Super admin users who manage trainer accounts and subscriptions';



COMMENT ON COLUMN "public"."admin_users"."role" IS 'Admin role: super_admin (full access) or admin (limited access)';



CREATE TABLE IF NOT EXISTS "public"."chart_config_audit" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_host" "text" NOT NULL,
    "actor_user_id" "uuid" NOT NULL,
    "target_kind" "text" NOT NULL,
    "target_id" "text" NOT NULL,
    "action" "text" NOT NULL,
    "before_charts" "jsonb",
    "after_charts" "jsonb",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "chart_config_audit_action_check" CHECK (("action" = ANY (ARRAY['save'::"text", 'apply_to_all'::"text", 'reset_to_template'::"text"]))),
    CONSTRAINT "chart_config_audit_target_kind_check" CHECK (("target_kind" = ANY (ARRAY['template'::"text", 'client'::"text"])))
);


ALTER TABLE "public"."chart_config_audit" OWNER TO "postgres";


COMMENT ON TABLE "public"."chart_config_audit" IS 'Best-effort audit trail of chart config changes. Non-blocking: a failed insert here MUST NOT roll back the underlying save. Retention: 12 months (cleanup TODO not in this scope).';



CREATE TABLE IF NOT EXISTS "public"."client_chart_configs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_host" "text" NOT NULL,
    "client_id" bigint NOT NULL,
    "charts" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "client_chart_configs_charts_is_object" CHECK (("jsonb_typeof"("charts") = 'object'::"text"))
);


ALTER TABLE "public"."client_chart_configs" OWNER TO "postgres";


COMMENT ON TABLE "public"."client_chart_configs" IS 'Per-client override for charts. Row absence => inherit trainer template live. Row presence => snapshot frozen to whatever was last saved here.';



COMMENT ON COLUMN "public"."client_chart_configs"."charts" IS 'Full snapshot, not a diff. Same shape as trainer_chart_templates.charts.';



CREATE TABLE IF NOT EXISTS "public"."client_checkins" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_host" "text" NOT NULL,
    "client_id" bigint NOT NULL,
    "checkin_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "checkin_time" timestamp with time zone DEFAULT "now"(),
    "mood" "text",
    "energy_level" integer,
    "notes" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "client_checkins_energy_level_check" CHECK ((("energy_level" >= 1) AND ("energy_level" <= 5))),
    CONSTRAINT "client_checkins_mood_check" CHECK (("mood" = ANY (ARRAY['great'::"text", 'good'::"text", 'okay'::"text", 'tired'::"text", 'bad'::"text"])))
);


ALTER TABLE "public"."client_checkins" OWNER TO "postgres";


COMMENT ON TABLE "public"."client_checkins" IS 'Daily client check-ins with mood and energy tracking';



CREATE TABLE IF NOT EXISTS "public"."client_form_configs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_host" "text" NOT NULL,
    "client_id" bigint NOT NULL,
    "form_type" "text" NOT NULL,
    "questions_config" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "uses_template" boolean DEFAULT true,
    "template_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "schedule" "jsonb",
    CONSTRAINT "client_form_configs_form_type_check" CHECK (("form_type" = ANY (ARRAY['checkins'::"text", 'habits'::"text"]))),
    CONSTRAINT "client_form_configs_schedule_valid" CHECK ((("schedule" IS NULL) OR (("schedule" ? 'frequency'::"text") AND ("schedule" ? 'days_of_week'::"text") AND ("schedule" ? 'time'::"text") AND ("schedule" ? 'timezone'::"text") AND (("schedule" ->> 'frequency'::"text") = ANY (ARRAY['weekly'::"text", 'biweekly'::"text", 'custom'::"text"])) AND ("jsonb_typeof"(("schedule" -> 'days_of_week'::"text")) = 'array'::"text") AND ("jsonb_array_length"(("schedule" -> 'days_of_week'::"text")) > 0))))
);


ALTER TABLE "public"."client_form_configs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."client_goals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_host" "text" NOT NULL,
    "client_id" bigint NOT NULL,
    "goal_type" "text" NOT NULL,
    "target_value" numeric NOT NULL,
    "unit" "text" NOT NULL,
    "start_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "target_date" "date",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "notes" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "client_goals_goal_type_check" CHECK (("goal_type" = ANY (ARRAY['water_daily'::"text", 'steps_daily'::"text", 'weight_target'::"text", 'body_fat_target'::"text", 'muscle_gain'::"text", 'custom'::"text"]))),
    CONSTRAINT "client_goals_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'completed'::"text", 'paused'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "valid_goal_dates" CHECK ((("target_date" IS NULL) OR ("target_date" >= "start_date")))
);


ALTER TABLE "public"."client_goals" OWNER TO "postgres";


COMMENT ON TABLE "public"."client_goals" IS 'Client health and fitness goals';



CREATE TABLE IF NOT EXISTS "public"."client_measurements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_host" "text" NOT NULL,
    "client_id" bigint NOT NULL,
    "trainer_id" "uuid" NOT NULL,
    "measurement_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "weight_kg" numeric,
    "height_cm" numeric,
    "body_fat_percentage" numeric,
    "muscle_mass_kg" numeric,
    "waist_cm" numeric,
    "chest_cm" numeric,
    "hips_cm" numeric,
    "bicep_cm" numeric,
    "thigh_cm" numeric,
    "notes" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."client_measurements" OWNER TO "postgres";


COMMENT ON TABLE "public"."client_measurements" IS 'Body measurements and composition tracking';



CREATE TABLE IF NOT EXISTS "public"."client_neat_cards" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" bigint NOT NULL,
    "tenant_host" "text" NOT NULL,
    "label" "text" NOT NULL,
    "card_order" integer DEFAULT 0 NOT NULL,
    "steps_goal" integer,
    "notes" "text",
    "weekdays" integer[] DEFAULT '{}'::integer[],
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "client_neat_cards_steps_goal_check" CHECK ((("steps_goal" IS NULL) OR ("steps_goal" >= 0)))
);


ALTER TABLE "public"."client_neat_cards" OWNER TO "postgres";


COMMENT ON TABLE "public"."client_neat_cards" IS 'NEAT activity cards for clients - flexible daily step goals with custom labels';



COMMENT ON COLUMN "public"."client_neat_cards"."label" IS 'Custom label for the NEAT card (e.g., "Día de entrenamiento", "Lunes", "Sesión de ciclismo")';



COMMENT ON COLUMN "public"."client_neat_cards"."card_order" IS 'Display order of cards';



COMMENT ON COLUMN "public"."client_neat_cards"."steps_goal" IS 'Daily step count goal';



COMMENT ON COLUMN "public"."client_neat_cards"."notes" IS 'Additional notes for the NEAT card';



COMMENT ON COLUMN "public"."client_neat_cards"."weekdays" IS 'Optional array of weekdays this card applies to (0=Sunday, 1=Monday, ..., 6=Saturday)';



CREATE TABLE IF NOT EXISTS "public"."client_programs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_host" "text" NOT NULL,
    "client_id" bigint NOT NULL,
    "program_id" "uuid" NOT NULL,
    "trainer_id" "uuid" NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "progress_percentage" integer DEFAULT 0,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "client_programs_progress_percentage_check" CHECK ((("progress_percentage" >= 0) AND ("progress_percentage" <= 100))),
    CONSTRAINT "client_programs_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'completed'::"text", 'paused'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "valid_date_range" CHECK ((("end_date" IS NULL) OR ("end_date" >= "start_date")))
);


ALTER TABLE "public"."client_programs" OWNER TO "postgres";


COMMENT ON TABLE "public"."client_programs" IS 'Programs assigned to specific clients';



CREATE TABLE IF NOT EXISTS "public"."client_step_tracking" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_host" "text" NOT NULL,
    "client_id" bigint NOT NULL,
    "tracking_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "step_count" integer NOT NULL,
    "distance_meters" numeric,
    "calories_burned" integer,
    "logged_at" timestamp with time zone DEFAULT "now"(),
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "client_step_tracking_step_count_check" CHECK (("step_count" >= 0))
);


ALTER TABLE "public"."client_step_tracking" OWNER TO "postgres";


COMMENT ON TABLE "public"."client_step_tracking" IS 'Daily step count and activity tracking';



CREATE TABLE IF NOT EXISTS "public"."client_supplement_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_host" "text" NOT NULL,
    "client_id" bigint NOT NULL,
    "trainer_id" "uuid" NOT NULL,
    "supplement_id" "uuid",
    "supplement_name" "text" NOT NULL,
    "supplement_description" "text",
    "dosage" "text" NOT NULL,
    "frequency" "text" NOT NULL,
    "timing" "text" NOT NULL,
    "notes" "text",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "client_supplement_assignments_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'paused'::"text", 'discontinued'::"text"]))),
    CONSTRAINT "dosage_not_empty" CHECK (("dosage" <> ''::"text")),
    CONSTRAINT "frequency_not_empty" CHECK (("frequency" <> ''::"text")),
    CONSTRAINT "supplement_name_not_empty" CHECK (("supplement_name" <> ''::"text")),
    CONSTRAINT "timing_not_empty" CHECK (("timing" <> ''::"text"))
);


ALTER TABLE "public"."client_supplement_assignments" OWNER TO "postgres";


COMMENT ON TABLE "public"."client_supplement_assignments" IS 'Assignments of supplements from inventory to specific clients';



COMMENT ON COLUMN "public"."client_supplement_assignments"."supplement_id" IS 'Reference to inventory item - SET NULL on delete to preserve assignment data';



COMMENT ON COLUMN "public"."client_supplement_assignments"."supplement_name" IS 'Denormalized product name - preserved when inventory item deleted';



COMMENT ON COLUMN "public"."client_supplement_assignments"."supplement_description" IS 'Denormalized product description - preserved when inventory item deleted';



CREATE TABLE IF NOT EXISTS "public"."client_water_intake" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_host" "text" NOT NULL,
    "client_id" bigint NOT NULL,
    "intake_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "amount_liters" numeric NOT NULL,
    "logged_at" timestamp with time zone DEFAULT "now"(),
    "notes" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "client_water_intake_amount_liters_check" CHECK (("amount_liters" >= (0)::numeric))
);


ALTER TABLE "public"."client_water_intake" OWNER TO "postgres";


COMMENT ON TABLE "public"."client_water_intake" IS 'Client water consumption tracking';



CREATE TABLE IF NOT EXISTS "public"."clients" (
    "id" bigint NOT NULL,
    "sign_up_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tenant" "uuid",
    "status" "public"."client_status" DEFAULT 'Onboarding Completado'::"public"."client_status",
    "name" "text",
    "last_name" "text",
    "nick_name" "text",
    "email" "text",
    "phone" "text",
    "occupation" "text",
    "dob" "date",
    "city" "text",
    "state" "text",
    "country" "text",
    "zip" "text",
    "national_id" "text",
    "profile_picture_url" "text",
    "password" "text",
    "last_login_at" timestamp with time zone
);


ALTER TABLE "public"."clients" OWNER TO "postgres";


ALTER TABLE "public"."clients" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."clients_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."exercise_log_sets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "exercise_log_id" "uuid" NOT NULL,
    "set_number" integer NOT NULL,
    "reps" integer,
    "weight_kg" numeric,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "video_url" "text"
);


ALTER TABLE "public"."exercise_log_sets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."exercise_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_host" "text" NOT NULL,
    "client_id" bigint NOT NULL,
    "trainer_id" "uuid" NOT NULL,
    "scheduled_session_id" "uuid",
    "exercise_id" "uuid" NOT NULL,
    "completed_at" timestamp with time zone DEFAULT "now"(),
    "sets_completed" integer,
    "reps_completed" "text",
    "weight_kg" numeric,
    "duration_seconds" integer,
    "distance_meters" numeric,
    "perceived_exertion" integer,
    "notes" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "video_url" "text",
    "finalized_at" timestamp with time zone,
    "training_date" "date",
    CONSTRAINT "exercise_logs_perceived_exertion_check" CHECK ((("perceived_exertion" >= 1) AND ("perceived_exertion" <= 10)))
);


ALTER TABLE "public"."exercise_logs" OWNER TO "postgres";


COMMENT ON TABLE "public"."exercise_logs" IS 'Client performance logs for completed exercises';



CREATE TABLE IF NOT EXISTS "public"."exercises" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_host" "text" NOT NULL,
    "trainer_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "category" "text",
    "muscle_groups" "text"[],
    "equipment" "text"[],
    "video_url" "text",
    "image_url" "text",
    "instructions" "text"[],
    "tips" "text"[],
    "is_public" boolean DEFAULT false,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "default_sets" integer,
    "default_reps" "text",
    "default_tempo" "text",
    "default_rest_seconds" integer,
    "default_training_system" "text",
    "movement_pattern" "text",
    "uploaded_video_url" "text",
    CONSTRAINT "exercises_category_check" CHECK (("category" = ANY (ARRAY['strength'::"text", 'cardio'::"text", 'flexibility'::"text", 'balance'::"text", 'plyometric'::"text", 'olympic'::"text", 'powerlifting'::"text", 'bodyweight'::"text", 'other'::"text"]))),
    CONSTRAINT "name_not_empty" CHECK (("name" <> ''::"text"))
);


ALTER TABLE "public"."exercises" OWNER TO "postgres";


COMMENT ON TABLE "public"."exercises" IS 'Exercise library with videos, instructions, and metadata';



COMMENT ON COLUMN "public"."exercises"."default_sets" IS 'Default number of sets for this exercise (can be overridden per session)';



COMMENT ON COLUMN "public"."exercises"."default_reps" IS 'Default repetitions (e.g., "10-12", "AMRAP") for this exercise';



COMMENT ON COLUMN "public"."exercises"."default_tempo" IS 'Default tempo (e.g., "Explosivo", "Pausa Final Excéntrica") for this exercise';



COMMENT ON COLUMN "public"."exercises"."default_rest_seconds" IS 'Default rest time in seconds between sets';



COMMENT ON COLUMN "public"."exercises"."default_training_system" IS 'Default training system (e.g., "Series Rectas", "Drop Sets") for this exercise';



COMMENT ON COLUMN "public"."exercises"."movement_pattern" IS 'Movement pattern classification (e.g., Sentadilla, Bisagra de cadera, Empuje horizontal, Tracción vertical)';



CREATE TABLE IF NOT EXISTS "public"."form_responses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_host" "text" NOT NULL,
    "client_id" bigint NOT NULL,
    "form_type" "text" NOT NULL,
    "response_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "answers" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "submitted_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "form_responses_form_type_check" CHECK (("form_type" = ANY (ARRAY['checkins'::"text", 'habits'::"text"]))),
    CONSTRAINT "valid_answers" CHECK (("jsonb_typeof"("answers") = 'object'::"text"))
);


ALTER TABLE "public"."form_responses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."form_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_host" "text" NOT NULL,
    "form_type" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "questions_config" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "default_schedule" "jsonb",
    "auto_apply_to_new_clients" boolean DEFAULT false NOT NULL,
    CONSTRAINT "form_templates_form_type_check" CHECK (("form_type" = ANY (ARRAY['checkins'::"text", 'habits'::"text"])))
);


ALTER TABLE "public"."form_templates" OWNER TO "postgres";


COMMENT ON COLUMN "public"."form_templates"."auto_apply_to_new_clients" IS 'When true, newly created clients for this tenant receive a client_form_configs row seeded from this template (questions_config + default_schedule) at creation time. Does NOT propagate to existing clients.';



CREATE TABLE IF NOT EXISTS "public"."invitation_codes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "created_by" "text" DEFAULT 'system'::"text",
    "created_at" timestamp without time zone DEFAULT "now"(),
    "expires_at" timestamp without time zone NOT NULL,
    "used_at" timestamp without time zone,
    "used_by_trainer_id" "uuid",
    "max_uses" integer DEFAULT 1,
    "current_uses" integer DEFAULT 0,
    "status" "text" DEFAULT 'active'::"text",
    CONSTRAINT "invitation_codes_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'used'::"text", 'expired'::"text", 'revoked'::"text"])))
);


ALTER TABLE "public"."invitation_codes" OWNER TO "postgres";


COMMENT ON TABLE "public"."invitation_codes" IS 'General invitation codes for trainer registration (not brand-specific)';



COMMENT ON COLUMN "public"."invitation_codes"."code" IS 'Unique invitation code for trainer registration';



COMMENT ON COLUMN "public"."invitation_codes"."max_uses" IS 'Maximum number of times this code can be used';



COMMENT ON COLUMN "public"."invitation_codes"."current_uses" IS 'Current number of times this code has been used';



CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_slug" "text" NOT NULL,
    "client_id" bigint NOT NULL,
    "sender_type" "public"."message_sender_type" NOT NULL,
    "sender_id" "text" NOT NULL,
    "sender_name" "text" NOT NULL,
    "message" "text" NOT NULL,
    "read_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "message_not_empty" CHECK (("message" <> ''::"text"))
);


ALTER TABLE "public"."messages" OWNER TO "postgres";


COMMENT ON TABLE "public"."messages" IS 'Stores chat messages between clients and trainers with tenant isolation';



CREATE TABLE IF NOT EXISTS "public"."microcycle_slots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "microcycle_id" "uuid" NOT NULL,
    "day_index" integer NOT NULL,
    "session_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "microcycle_slots_day_index_check" CHECK (("day_index" >= 1))
);


ALTER TABLE "public"."microcycle_slots" OWNER TO "postgres";


COMMENT ON TABLE "public"."microcycle_slots" IS 'Slots ordenados (day_index 1..N) que apuntan a una session, o representan un día de descanso explícito si session_id es NULL.';



COMMENT ON COLUMN "public"."microcycle_slots"."day_index" IS 'Posición 1-based dentro del microciclo. UNIQUE(microcycle_id, day_index) impide duplicados. La validación day_index <= duration_days vive en la capa API (no en SQL para no acoplar las dos tablas con un trigger).';



COMMENT ON COLUMN "public"."microcycle_slots"."session_id" IS 'NULL = día de descanso explícito. Días sin slot también son descanso (descanso automático, ver decisión c en §1 de bloque-1-spec.md). ON DELETE SET NULL: si la session referenciada se borra, el slot pasa a descanso en lugar de eliminarse.';



CREATE TABLE IF NOT EXISTS "public"."microcycles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_host" "text" NOT NULL,
    "client_program_id" "uuid" NOT NULL,
    "duration_days" integer DEFAULT 7 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "start_date" "date" NOT NULL,
    CONSTRAINT "microcycles_duration_days_check" CHECK ((("duration_days" >= 1) AND ("duration_days" <= 28)))
);


ALTER TABLE "public"."microcycles" OWNER TO "postgres";


COMMENT ON TABLE "public"."microcycles" IS 'Secuencia ordenada de N días que estructura el plan de un cliente sobre un client_program. Se repite igual cada vuelta hasta que el entrenador la modifique.';



COMMENT ON COLUMN "public"."microcycles"."client_program_id" IS 'FK a client_programs. UNIQUE: un microciclo por programa de cliente. Si más adelante se quieren microciclos progresivos (semana 1 ≠ semana 2), se quita este constraint y se añade cycle_index/effective_from.';



COMMENT ON COLUMN "public"."microcycles"."duration_days" IS 'Cantidad de días del microciclo. Default 7. Rango 1–28 como guardrail; nadie debería querer microciclos de meses.';



CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_slug" "text" NOT NULL,
    "client_id" bigint NOT NULL,
    "type" "public"."notification_type" NOT NULL,
    "title" "text" NOT NULL,
    "message" "text" NOT NULL,
    "link" "text",
    "icon" "text",
    "read_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "trainer_id" "uuid",
    CONSTRAINT "icon_not_empty" CHECK (("icon" <> ''::"text")),
    CONSTRAINT "message_not_empty" CHECK (("message" <> ''::"text")),
    CONSTRAINT "title_not_empty" CHECK (("title" <> ''::"text"))
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


COMMENT ON TABLE "public"."notifications" IS 'Stores notifications for clients with tenant isolation';



CREATE TABLE IF NOT EXISTS "public"."nutrition_days" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nutrition_plan_id" "uuid" NOT NULL,
    "tenant_host" "text" NOT NULL,
    "day_label" "text" NOT NULL,
    "day_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "protein" numeric(10,2) DEFAULT 0,
    "carbs" numeric(10,2) DEFAULT 0,
    "fats" numeric(10,2) DEFAULT 0,
    "calories" numeric(10,2) DEFAULT 0,
    "weekdays" integer[] DEFAULT '{}'::integer[],
    CONSTRAINT "day_label_not_empty" CHECK (("day_label" <> ''::"text"))
);


ALTER TABLE "public"."nutrition_days" OWNER TO "postgres";


COMMENT ON TABLE "public"."nutrition_days" IS 'Days within a nutrition plan';



COMMENT ON COLUMN "public"."nutrition_days"."protein" IS 'Day-level protein in grams - can be manually set or calculated from meals';



COMMENT ON COLUMN "public"."nutrition_days"."carbs" IS 'Day-level carbohydrates in grams - can be manually set or calculated from meals';



COMMENT ON COLUMN "public"."nutrition_days"."fats" IS 'Day-level fats in grams - can be manually set or calculated from meals';



COMMENT ON COLUMN "public"."nutrition_days"."calories" IS 'Day-level calories in kcal - can be manually set or calculated from meals';



CREATE TABLE IF NOT EXISTS "public"."nutrition_ingredients" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nutrition_meal_id" "uuid" NOT NULL,
    "tenant_host" "text" NOT NULL,
    "name" "text" NOT NULL,
    "quantity" "text" NOT NULL,
    "unit" "text" NOT NULL,
    "ingredient_order" integer DEFAULT 0 NOT NULL,
    "protein" numeric(10,2),
    "carbs" numeric(10,2),
    "fats" numeric(10,2),
    "calories" numeric(10,2),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "option_id" "uuid" NOT NULL,
    CONSTRAINT "name_not_empty" CHECK (("name" <> ''::"text"))
);


ALTER TABLE "public"."nutrition_ingredients" OWNER TO "postgres";


COMMENT ON TABLE "public"."nutrition_ingredients" IS 'Ingredients within meals with optional nutritional data';



COMMENT ON COLUMN "public"."nutrition_ingredients"."nutrition_meal_id" IS 'Denormalized meal reference for simpler queries; canonical parent is nutrition_meal_options.meal_id via option_id.';



CREATE TABLE IF NOT EXISTS "public"."nutrition_meal_options" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "meal_id" "uuid" NOT NULL,
    "name" "text" DEFAULT 'Opción 1'::"text" NOT NULL,
    "option_order" integer DEFAULT 1 NOT NULL,
    "protein" numeric(10,2),
    "carbs" numeric(10,2),
    "fats" numeric(10,2),
    "calories" numeric(10,2),
    "image_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "instructions" "text",
    "prep_time_minutes" integer,
    "cooking_time_minutes" integer,
    "servings" integer,
    "recipe_notes" "text"
);


ALTER TABLE "public"."nutrition_meal_options" OWNER TO "postgres";


COMMENT ON TABLE "public"."nutrition_meal_options" IS 'Alternatives within a meal (e.g. Opción 1 / Opción 2). Ingredients attach to an option. Hierarchy: plan → days → meals → options → ingredients.';



COMMENT ON COLUMN "public"."nutrition_meal_options"."instructions" IS 'Free-form preparation instructions (multi-line). Rendered with whitespace-pre-wrap on the client.';



COMMENT ON COLUMN "public"."nutrition_meal_options"."prep_time_minutes" IS 'Preparation time in minutes (excludes cooking).';



COMMENT ON COLUMN "public"."nutrition_meal_options"."cooking_time_minutes" IS 'Cooking/oven/stove time in minutes.';



COMMENT ON COLUMN "public"."nutrition_meal_options"."servings" IS 'How many people the recipe as written feeds. NULL = unspecified.';



COMMENT ON COLUMN "public"."nutrition_meal_options"."recipe_notes" IS 'Short extra note for the client (substitutions, tips, allergens, etc.).';



CREATE TABLE IF NOT EXISTS "public"."nutrition_meals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nutrition_day_id" "uuid" NOT NULL,
    "tenant_host" "text" NOT NULL,
    "label" "text" NOT NULL,
    "meal_order" integer DEFAULT 0 NOT NULL,
    "notes" "text",
    "protein" numeric(10,2) DEFAULT 0,
    "carbs" numeric(10,2) DEFAULT 0,
    "fats" numeric(10,2) DEFAULT 0,
    "calories" numeric(10,2) DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "image_url" "text",
    "has_alternatives" boolean DEFAULT false NOT NULL,
    "show_calories" boolean,
    CONSTRAINT "label_not_empty" CHECK (("label" <> ''::"text"))
);


ALTER TABLE "public"."nutrition_meals" OWNER TO "postgres";


COMMENT ON TABLE "public"."nutrition_meals" IS 'Meals within a day with meal-level macros for easier diet uploads';



COMMENT ON COLUMN "public"."nutrition_meals"."protein" IS 'Meal-level protein in grams';



COMMENT ON COLUMN "public"."nutrition_meals"."carbs" IS 'Meal-level carbohydrates in grams';



COMMENT ON COLUMN "public"."nutrition_meals"."fats" IS 'Meal-level fats in grams';



COMMENT ON COLUMN "public"."nutrition_meals"."calories" IS 'Meal-level calories in kcal';



COMMENT ON COLUMN "public"."nutrition_meals"."image_url" IS 'Public URL for meal image in Supabase Storage (meal-images bucket)';



COMMENT ON COLUMN "public"."nutrition_meals"."has_alternatives" IS 'True when this meal has more than one nutrition_meal_options row; avoids counting options on every read.';



COMMENT ON COLUMN "public"."nutrition_meals"."show_calories" IS 'Per-meal override for calorie visibility. NULL = inherit from nutrition_plans.show_calories. true/false = explicit override.';



CREATE TABLE IF NOT EXISTS "public"."nutrition_option_selections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" bigint NOT NULL,
    "meal_id" "uuid" NOT NULL,
    "option_id" "uuid" NOT NULL,
    "selected_date" "date" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."nutrition_option_selections" OWNER TO "postgres";


COMMENT ON TABLE "public"."nutrition_option_selections" IS 'Which nutrition_meal_options row a client chose for a given calendar day; one row per client/meal/date.';



CREATE TABLE IF NOT EXISTS "public"."nutrition_plans" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_host" "text" NOT NULL,
    "client_id" bigint,
    "trainer_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "start_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "is_template" boolean DEFAULT false,
    "show_meal_images" boolean DEFAULT true NOT NULL,
    "plan_mode" "text" DEFAULT 'structured'::"text" NOT NULL,
    "pdf_url" "text",
    "pdf_name" "text",
    "show_calories" boolean DEFAULT true NOT NULL,
    CONSTRAINT "name_not_empty" CHECK (("name" <> ''::"text")),
    CONSTRAINT "nutrition_plans_plan_mode_check" CHECK (("plan_mode" = ANY (ARRAY['structured'::"text", 'pdf'::"text", 'hybrid'::"text"]))),
    CONSTRAINT "nutrition_plans_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'completed'::"text", 'paused'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."nutrition_plans" OWNER TO "postgres";


COMMENT ON TABLE "public"."nutrition_plans" IS 'Nutrition plans assigned to clients by trainers';



COMMENT ON COLUMN "public"."nutrition_plans"."show_meal_images" IS 'When true, client app may show meal images; trainers can hide images per plan';



COMMENT ON COLUMN "public"."nutrition_plans"."show_calories" IS 'Whether calorie counts are shown to the client. Default true (backward compatible). Overridable per meal via nutrition_meals.show_calories.';



CREATE TABLE IF NOT EXISTS "public"."password_reset_otps" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "otp_hash" "text" NOT NULL,
    "user_type" "text" NOT NULL,
    "tenant_slug" "text",
    "expires_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "used_at" timestamp with time zone,
    "attempts" integer DEFAULT 0 NOT NULL,
    "max_attempts" integer DEFAULT 5 NOT NULL,
    "ip_address" "text",
    "reset_token" "text",
    "reset_token_expires_at" timestamp with time zone,
    CONSTRAINT "password_reset_otps_email_lowercase" CHECK (("email" = "lower"("email"))),
    CONSTRAINT "password_reset_otps_email_trimmed" CHECK (("email" = TRIM(BOTH FROM "email"))),
    CONSTRAINT "password_reset_otps_tenant_slug_by_user_type" CHECK (((("user_type" = 'trainer'::"text") AND ("tenant_slug" IS NULL)) OR (("user_type" = 'client'::"text") AND ("tenant_slug" IS NOT NULL)))),
    CONSTRAINT "password_reset_otps_user_type_check" CHECK (("user_type" = ANY (ARRAY['trainer'::"text", 'client'::"text"])))
);


ALTER TABLE "public"."password_reset_otps" OWNER TO "postgres";


COMMENT ON TABLE "public"."password_reset_otps" IS 'Password reset flow: stores hashed OTP and optional hashed reset_token. RLS allows anon INSERT/SELECT/UPDATE; authorization is enforced in API routes.';



CREATE TABLE IF NOT EXISTS "public"."personal_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_host" "text" NOT NULL,
    "client_id" bigint NOT NULL,
    "trainer_id" "uuid" NOT NULL,
    "exercise_id" "uuid" NOT NULL,
    "record_type" "text" NOT NULL,
    "value" numeric NOT NULL,
    "unit" "text" NOT NULL,
    "achieved_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "exercise_log_id" "uuid",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "personal_records_record_type_check" CHECK (("record_type" = ANY (ARRAY['max_weight'::"text", 'max_reps'::"text", 'max_distance'::"text", 'best_time'::"text"])))
);


ALTER TABLE "public"."personal_records" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."programs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_host" "text" NOT NULL,
    "trainer_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "duration_weeks" integer,
    "difficulty_level" "text",
    "is_template" boolean DEFAULT true,
    "is_published" boolean DEFAULT false,
    "tags" "text"[],
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "name_not_empty" CHECK (("name" <> ''::"text")),
    CONSTRAINT "programs_difficulty_level_check" CHECK (("difficulty_level" = ANY (ARRAY['beginner'::"text", 'intermediate'::"text", 'advanced'::"text"])))
);


ALTER TABLE "public"."programs" OWNER TO "postgres";


COMMENT ON TABLE "public"."programs" IS 'Training program templates created by trainers';



CREATE TABLE IF NOT EXISTS "public"."scheduled_session_exercise_sets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_host" "text" NOT NULL,
    "scheduled_session_exercise_id" "uuid" NOT NULL,
    "set_number" integer NOT NULL,
    "reps" "text",
    "weight_kg" numeric,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."scheduled_session_exercise_sets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."scheduled_session_exercises" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_host" "text" NOT NULL,
    "scheduled_session_id" "uuid" NOT NULL,
    "exercise_id" "uuid" NOT NULL,
    "exercise_order" integer NOT NULL,
    "sets" integer,
    "reps" "text",
    "weight_kg" numeric,
    "duration_seconds" integer,
    "distance_meters" numeric,
    "rest_seconds" integer,
    "notes" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."scheduled_session_exercises" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."scheduled_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_host" "text" NOT NULL,
    "client_id" bigint NOT NULL,
    "trainer_id" "uuid" NOT NULL,
    "session_id" "uuid",
    "client_program_id" "uuid",
    "scheduled_date" "date" NOT NULL,
    "scheduled_time" time without time zone,
    "duration_minutes" integer,
    "status" "text" DEFAULT 'scheduled'::"text" NOT NULL,
    "completion_date" timestamp with time zone,
    "client_notes" "text",
    "trainer_notes" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "prescribed_by" "text" DEFAULT 'trainer'::"text" NOT NULL,
    CONSTRAINT "scheduled_sessions_prescribed_by_check" CHECK (("prescribed_by" = ANY (ARRAY['trainer'::"text", 'client'::"text"]))),
    CONSTRAINT "scheduled_sessions_status_check" CHECK (("status" = ANY (ARRAY['scheduled'::"text", 'completed'::"text", 'missed'::"text", 'cancelled'::"text", 'rescheduled'::"text"])))
);


ALTER TABLE "public"."scheduled_sessions" OWNER TO "postgres";


COMMENT ON TABLE "public"."scheduled_sessions" IS 'Calendar events for client workout sessions';



CREATE TABLE IF NOT EXISTS "public"."session_exercises" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_host" "text" NOT NULL,
    "session_id" "uuid" NOT NULL,
    "exercise_id" "uuid" NOT NULL,
    "exercise_order" integer NOT NULL,
    "sets" integer,
    "reps" "text",
    "duration_seconds" integer,
    "rest_seconds" integer,
    "weight_kg" numeric,
    "distance_meters" numeric,
    "notes" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "custom_name" "text"
);


ALTER TABLE "public"."session_exercises" OWNER TO "postgres";


COMMENT ON TABLE "public"."session_exercises" IS 'Exercises assigned to session templates with sets/reps/weights';



CREATE TABLE IF NOT EXISTS "public"."sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_host" "text" NOT NULL,
    "program_id" "uuid",
    "trainer_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "session_order" integer,
    "duration_minutes" integer,
    "session_type" "text",
    "intensity_level" "text",
    "equipment_needed" "text"[],
    "notes" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "name_not_empty" CHECK (("name" <> ''::"text")),
    CONSTRAINT "sessions_intensity_level_check" CHECK (("intensity_level" = ANY (ARRAY['low'::"text", 'moderate'::"text", 'high'::"text"]))),
    CONSTRAINT "sessions_session_type_check" CHECK (("session_type" = ANY (ARRAY['strength'::"text", 'cardio'::"text", 'flexibility'::"text", 'sports'::"text", 'recovery'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."sessions" OWNER TO "postgres";


COMMENT ON TABLE "public"."sessions" IS 'Session templates (workouts) within programs';



CREATE TABLE IF NOT EXISTS "public"."supplement_inventory" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_host" "text" NOT NULL,
    "trainer_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "quantity" numeric(10,2) DEFAULT 0,
    "unit" "text",
    "images" "text"[] DEFAULT '{}'::"text"[],
    "is_archived" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "product_url" "text",
    CONSTRAINT "max_5_images" CHECK ((("array_length"("images", 1) IS NULL) OR ("array_length"("images", 1) <= 5))),
    CONSTRAINT "name_not_empty" CHECK (("name" <> ''::"text")),
    CONSTRAINT "quantity_non_negative" CHECK ((("quantity" IS NULL) OR ("quantity" >= (0)::numeric)))
);


ALTER TABLE "public"."supplement_inventory" OWNER TO "postgres";


COMMENT ON TABLE "public"."supplement_inventory" IS 'Centralized inventory of supplements managed by trainers';



COMMENT ON COLUMN "public"."supplement_inventory"."quantity" IS 'Optional quantity per unit - made optional per client request';



COMMENT ON COLUMN "public"."supplement_inventory"."unit" IS 'Optional unit of measurement - made optional per client request';



COMMENT ON COLUMN "public"."supplement_inventory"."images" IS 'Array of image URLs (max 5 images per supplement)';



COMMENT ON COLUMN "public"."supplement_inventory"."is_archived" IS 'Soft delete flag - archived items not shown in inventory picker';



COMMENT ON COLUMN "public"."supplement_inventory"."product_url" IS 'Optional URL link to product page or purchase link';



CREATE TABLE IF NOT EXISTS "public"."tenant_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "host" "text" NOT NULL,
    "actor" "text",
    "event_type" "text" NOT NULL,
    "payload_hash" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."tenant_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tenants" (
    "host" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "theme_slug" "text" NOT NULL,
    "tables" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "stripe_customer_portal_conf" "jsonb",
    "features" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "status" "public"."tenant_status" DEFAULT 'active'::"public"."tenant_status" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "theme_json" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "theme_version" "text",
    "maintenance_reason" "text",
    "maintenance_until" timestamp with time zone,
    "trainer_id" "uuid",
    "logo_url" "text",
    "onboarding_completed" boolean,
    CONSTRAINT "tenants_host_not_empty" CHECK (("length"(TRIM(BOTH FROM "host")) > 0)),
    CONSTRAINT "tenants_slug_not_empty" CHECK (("length"(TRIM(BOTH FROM "slug")) > 0)),
    CONSTRAINT "tenants_theme_slug_not_empty" CHECK (("length"(TRIM(BOTH FROM "theme_slug")) > 0))
);


ALTER TABLE "public"."tenants" OWNER TO "postgres";


COMMENT ON TABLE "public"."tenants" IS 'Multi-tenant configuration store for domain and theme management';



COMMENT ON COLUMN "public"."tenants"."tables" IS 'Internal table configuration and feature mappings (JSON)';



COMMENT ON COLUMN "public"."tenants"."logo_url" IS 'URL of the uploaded logo stored in Supabase Storage';



CREATE TABLE IF NOT EXISTS "public"."trainer_chart_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_host" "text" NOT NULL,
    "trainer_id" "uuid" NOT NULL,
    "charts" "jsonb" DEFAULT "jsonb_build_object"('version', 1, 'charts', '[]'::"jsonb") NOT NULL,
    "auto_apply_to_new_clients" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "trainer_chart_templates_charts_is_object" CHECK (("jsonb_typeof"("charts") = 'object'::"text"))
);


ALTER TABLE "public"."trainer_chart_templates" OWNER TO "postgres";


COMMENT ON TABLE "public"."trainer_chart_templates" IS 'Default chart template per trainer. Clients fall back to this when no row exists in client_chart_configs.';



COMMENT ON COLUMN "public"."trainer_chart_templates"."charts" IS 'Document of the form { version: 1, charts: ChartConfig[] }. Schema validated in app layer (lib/charts/validation.ts), not in SQL.';



COMMENT ON COLUMN "public"."trainer_chart_templates"."auto_apply_to_new_clients" IS 'When true, newly-created clients of this trainer have NO override row by default — they inherit this template live. Future template edits propagate automatically.';



CREATE TABLE IF NOT EXISTS "public"."trainers" (
    "id" "uuid" NOT NULL,
    "tenant_host" "text" NOT NULL,
    "email" "text" NOT NULL,
    "full_name" "text",
    "invitation_code_used" "text",
    "created_at" timestamp without time zone DEFAULT "now"(),
    "updated_at" timestamp without time zone DEFAULT "now"(),
    "last_login_at" timestamp without time zone,
    "status" "text" DEFAULT 'active'::"text",
    "subscription_status" "text" DEFAULT 'active'::"text",
    "password_set_at" timestamp without time zone,
    "invited_by" "uuid",
    "invited_at" timestamp without time zone DEFAULT "now"(),
    "profile_picture_url" "text",
    "phone" "text",
    "community_url" "text",
    CONSTRAINT "trainers_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'inactive'::"text"]))),
    CONSTRAINT "trainers_subscription_status_check" CHECK (("subscription_status" = ANY (ARRAY['active'::"text", 'paused'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."trainers" OWNER TO "postgres";


COMMENT ON TABLE "public"."trainers" IS 'Trainer accounts - each trainer owns one tenant';



COMMENT ON COLUMN "public"."trainers"."tenant_host" IS 'The domain/host this trainer owns (e.g., ironfit.localhost)';



COMMENT ON COLUMN "public"."trainers"."invitation_code_used" IS 'Optional invitation code that was used during registration (deprecated field, kept for historical data)';



COMMENT ON COLUMN "public"."trainers"."subscription_status" IS 'Trainer subscription status: active, paused, or cancelled';



COMMENT ON COLUMN "public"."trainers"."password_set_at" IS 'Timestamp when trainer first set their password. NULL = needs to complete password setup on next login (new trainers only).';



COMMENT ON COLUMN "public"."trainers"."invited_by" IS 'Which admin created this trainer account';



COMMENT ON COLUMN "public"."trainers"."invited_at" IS 'When the trainer invitation was created';



COMMENT ON COLUMN "public"."trainers"."community_url" IS 'External URL for trainer community (Go High Level, etc.). Displayed in client dashboard Community tab when set.';



ALTER TABLE ONLY "public"."admin_users"
    ADD CONSTRAINT "admin_users_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."admin_users"
    ADD CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chart_config_audit"
    ADD CONSTRAINT "chart_config_audit_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_chart_configs"
    ADD CONSTRAINT "client_chart_configs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_chart_configs"
    ADD CONSTRAINT "client_chart_configs_unique_per_client" UNIQUE ("tenant_host", "client_id");



ALTER TABLE ONLY "public"."client_checkins"
    ADD CONSTRAINT "client_checkins_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_form_configs"
    ADD CONSTRAINT "client_form_configs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_goals"
    ADD CONSTRAINT "client_goals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_measurements"
    ADD CONSTRAINT "client_measurements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_neat_cards"
    ADD CONSTRAINT "client_neat_cards_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_programs"
    ADD CONSTRAINT "client_programs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_step_tracking"
    ADD CONSTRAINT "client_step_tracking_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_supplement_assignments"
    ADD CONSTRAINT "client_supplement_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_water_intake"
    ADD CONSTRAINT "client_water_intake_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_id_key" UNIQUE ("id");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."exercise_log_sets"
    ADD CONSTRAINT "exercise_log_sets_exercise_log_id_set_number_key" UNIQUE ("exercise_log_id", "set_number");



ALTER TABLE ONLY "public"."exercise_log_sets"
    ADD CONSTRAINT "exercise_log_sets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."exercise_logs"
    ADD CONSTRAINT "exercise_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."exercises"
    ADD CONSTRAINT "exercises_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."form_responses"
    ADD CONSTRAINT "form_responses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."form_responses"
    ADD CONSTRAINT "form_responses_unique_per_day" UNIQUE ("tenant_host", "client_id", "form_type", "response_date");



ALTER TABLE ONLY "public"."form_templates"
    ADD CONSTRAINT "form_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invitation_codes"
    ADD CONSTRAINT "invitation_codes_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."invitation_codes"
    ADD CONSTRAINT "invitation_codes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."microcycle_slots"
    ADD CONSTRAINT "microcycle_slots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."microcycle_slots"
    ADD CONSTRAINT "microcycle_slots_unique_day_per_microcycle" UNIQUE ("microcycle_id", "day_index");



ALTER TABLE ONLY "public"."microcycles"
    ADD CONSTRAINT "microcycles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."microcycles"
    ADD CONSTRAINT "microcycles_unique_per_client_program" UNIQUE ("client_program_id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."nutrition_days"
    ADD CONSTRAINT "nutrition_days_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."nutrition_ingredients"
    ADD CONSTRAINT "nutrition_ingredients_pkey" PRIMARY KEY ("id");



ALTER TABLE "public"."nutrition_meal_options"
    ADD CONSTRAINT "nutrition_meal_options_cooking_time_nonneg" CHECK ((("cooking_time_minutes" IS NULL) OR ("cooking_time_minutes" >= 0))) NOT VALID;



ALTER TABLE ONLY "public"."nutrition_meal_options"
    ADD CONSTRAINT "nutrition_meal_options_pkey" PRIMARY KEY ("id");



ALTER TABLE "public"."nutrition_meal_options"
    ADD CONSTRAINT "nutrition_meal_options_prep_time_nonneg" CHECK ((("prep_time_minutes" IS NULL) OR ("prep_time_minutes" >= 0))) NOT VALID;



ALTER TABLE "public"."nutrition_meal_options"
    ADD CONSTRAINT "nutrition_meal_options_servings_positive" CHECK ((("servings" IS NULL) OR ("servings" >= 1))) NOT VALID;



ALTER TABLE ONLY "public"."nutrition_meals"
    ADD CONSTRAINT "nutrition_meals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."nutrition_option_selections"
    ADD CONSTRAINT "nutrition_option_selections_client_meal_date_uniq" UNIQUE ("client_id", "meal_id", "selected_date");



ALTER TABLE ONLY "public"."nutrition_option_selections"
    ADD CONSTRAINT "nutrition_option_selections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."nutrition_plans"
    ADD CONSTRAINT "nutrition_plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."password_reset_otps"
    ADD CONSTRAINT "password_reset_otps_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."personal_records"
    ADD CONSTRAINT "personal_records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."programs"
    ADD CONSTRAINT "programs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."scheduled_session_exercise_sets"
    ADD CONSTRAINT "scheduled_session_exercise_sets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."scheduled_session_exercises"
    ADD CONSTRAINT "scheduled_session_exercises_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."scheduled_sessions"
    ADD CONSTRAINT "scheduled_sessions_client_date_session_unique" UNIQUE ("client_id", "scheduled_date", "session_id");



ALTER TABLE ONLY "public"."scheduled_sessions"
    ADD CONSTRAINT "scheduled_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."session_exercises"
    ADD CONSTRAINT "session_exercises_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."supplement_inventory"
    ADD CONSTRAINT "supplement_inventory_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tenant_events"
    ADD CONSTRAINT "tenant_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tenants"
    ADD CONSTRAINT "tenants_pkey" PRIMARY KEY ("host");



ALTER TABLE ONLY "public"."trainer_chart_templates"
    ADD CONSTRAINT "trainer_chart_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trainer_chart_templates"
    ADD CONSTRAINT "trainer_chart_templates_unique_per_trainer" UNIQUE ("tenant_host", "trainer_id");



ALTER TABLE ONLY "public"."trainers"
    ADD CONSTRAINT "trainers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trainers"
    ADD CONSTRAINT "trainers_tenant_host_key" UNIQUE ("tenant_host");



ALTER TABLE ONLY "public"."client_checkins"
    ADD CONSTRAINT "unique_client_checkin_per_day" UNIQUE ("client_id", "checkin_date");



ALTER TABLE ONLY "public"."personal_records"
    ADD CONSTRAINT "unique_client_exercise_record_type" UNIQUE ("client_id", "exercise_id", "record_type");



ALTER TABLE ONLY "public"."client_form_configs"
    ADD CONSTRAINT "unique_client_form_type" UNIQUE ("client_id", "form_type");



ALTER TABLE ONLY "public"."client_step_tracking"
    ADD CONSTRAINT "unique_client_steps_per_day" UNIQUE ("client_id", "tracking_date");



ALTER TABLE ONLY "public"."scheduled_session_exercises"
    ADD CONSTRAINT "unique_scheduled_session_exercise_order" UNIQUE ("scheduled_session_id", "exercise_order");



ALTER TABLE ONLY "public"."scheduled_session_exercise_sets"
    ADD CONSTRAINT "unique_sse_set_number" UNIQUE ("scheduled_session_exercise_id", "set_number");



ALTER TABLE ONLY "public"."form_templates"
    ADD CONSTRAINT "unique_tenant_form_type" UNIQUE ("tenant_host", "form_type");



CREATE INDEX "admin_users_email_idx" ON "public"."admin_users" USING "btree" ("email");



CREATE INDEX "admin_users_role_idx" ON "public"."admin_users" USING "btree" ("role");



CREATE INDEX "admin_users_status_idx" ON "public"."admin_users" USING "btree" ("status");



CREATE INDEX "chart_config_audit_actor_idx" ON "public"."chart_config_audit" USING "btree" ("actor_user_id", "created_at" DESC);



CREATE INDEX "chart_config_audit_target_idx" ON "public"."chart_config_audit" USING "btree" ("tenant_host", "target_kind", "target_id", "created_at" DESC);



CREATE INDEX "client_chart_configs_client_idx" ON "public"."client_chart_configs" USING "btree" ("client_id");



CREATE INDEX "client_chart_configs_tenant_idx" ON "public"."client_chart_configs" USING "btree" ("tenant_host");



CREATE INDEX "client_chart_configs_updated_at_idx" ON "public"."client_chart_configs" USING "btree" ("updated_at" DESC);



CREATE INDEX "client_checkins_client_idx" ON "public"."client_checkins" USING "btree" ("client_id");



CREATE INDEX "client_checkins_date_idx" ON "public"."client_checkins" USING "btree" ("checkin_date");



CREATE INDEX "client_checkins_tenant_idx" ON "public"."client_checkins" USING "btree" ("tenant_host");



CREATE INDEX "client_form_configs_client_idx" ON "public"."client_form_configs" USING "btree" ("client_id");



CREATE INDEX "client_form_configs_composite_idx" ON "public"."client_form_configs" USING "btree" ("client_id", "form_type");



CREATE INDEX "client_form_configs_questions_gin_idx" ON "public"."client_form_configs" USING "gin" ("questions_config");



CREATE INDEX "client_form_configs_template_idx" ON "public"."client_form_configs" USING "btree" ("template_id");



CREATE INDEX "client_form_configs_tenant_idx" ON "public"."client_form_configs" USING "btree" ("tenant_host");



CREATE INDEX "client_goals_client_idx" ON "public"."client_goals" USING "btree" ("client_id");



CREATE INDEX "client_goals_status_idx" ON "public"."client_goals" USING "btree" ("status");



CREATE INDEX "client_goals_tenant_idx" ON "public"."client_goals" USING "btree" ("tenant_host");



CREATE INDEX "client_goals_type_idx" ON "public"."client_goals" USING "btree" ("goal_type");



CREATE INDEX "client_measurements_client_idx" ON "public"."client_measurements" USING "btree" ("client_id");



CREATE INDEX "client_measurements_date_idx" ON "public"."client_measurements" USING "btree" ("measurement_date");



CREATE INDEX "client_measurements_trainer_idx" ON "public"."client_measurements" USING "btree" ("trainer_id");



CREATE INDEX "client_neat_cards_client_idx" ON "public"."client_neat_cards" USING "btree" ("client_id", "tenant_host");



CREATE INDEX "client_neat_cards_order_idx" ON "public"."client_neat_cards" USING "btree" ("client_id", "tenant_host", "card_order");



CREATE INDEX "client_neat_cards_tenant_idx" ON "public"."client_neat_cards" USING "btree" ("tenant_host");



CREATE INDEX "client_programs_client_idx" ON "public"."client_programs" USING "btree" ("client_id");



CREATE INDEX "client_programs_status_idx" ON "public"."client_programs" USING "btree" ("status");



CREATE INDEX "client_programs_tenant_idx" ON "public"."client_programs" USING "btree" ("tenant_host");



CREATE INDEX "client_programs_trainer_idx" ON "public"."client_programs" USING "btree" ("trainer_id");



CREATE INDEX "client_step_tracking_client_idx" ON "public"."client_step_tracking" USING "btree" ("client_id");



CREATE INDEX "client_step_tracking_date_idx" ON "public"."client_step_tracking" USING "btree" ("tracking_date");



CREATE INDEX "client_step_tracking_tenant_idx" ON "public"."client_step_tracking" USING "btree" ("tenant_host");



CREATE INDEX "client_supplement_assignments_client_idx" ON "public"."client_supplement_assignments" USING "btree" ("client_id");



CREATE INDEX "client_supplement_assignments_status_idx" ON "public"."client_supplement_assignments" USING "btree" ("status");



CREATE INDEX "client_supplement_assignments_supplement_idx" ON "public"."client_supplement_assignments" USING "btree" ("supplement_id");



CREATE INDEX "client_supplement_assignments_tenant_idx" ON "public"."client_supplement_assignments" USING "btree" ("tenant_host");



CREATE INDEX "client_supplement_assignments_trainer_idx" ON "public"."client_supplement_assignments" USING "btree" ("trainer_id");



CREATE INDEX "client_water_intake_client_idx" ON "public"."client_water_intake" USING "btree" ("client_id");



CREATE INDEX "client_water_intake_date_idx" ON "public"."client_water_intake" USING "btree" ("intake_date");



CREATE INDEX "client_water_intake_tenant_idx" ON "public"."client_water_intake" USING "btree" ("tenant_host");



CREATE INDEX "exercise_logs_client_idx" ON "public"."exercise_logs" USING "btree" ("client_id");



CREATE INDEX "exercise_logs_completed_idx" ON "public"."exercise_logs" USING "btree" ("completed_at");



CREATE INDEX "exercise_logs_exercise_idx" ON "public"."exercise_logs" USING "btree" ("exercise_id");



CREATE INDEX "exercise_logs_session_idx" ON "public"."exercise_logs" USING "btree" ("scheduled_session_id");



CREATE INDEX "exercise_logs_trainer_idx" ON "public"."exercise_logs" USING "btree" ("trainer_id");



CREATE INDEX "exercises_category_idx" ON "public"."exercises" USING "btree" ("category");



CREATE INDEX "exercises_public_idx" ON "public"."exercises" USING "btree" ("is_public");



CREATE INDEX "exercises_tenant_idx" ON "public"."exercises" USING "btree" ("tenant_host");



CREATE INDEX "exercises_trainer_idx" ON "public"."exercises" USING "btree" ("trainer_id");



CREATE INDEX "form_responses_answers_gin_idx" ON "public"."form_responses" USING "gin" ("answers");



CREATE INDEX "form_responses_client_idx" ON "public"."form_responses" USING "btree" ("client_id");



CREATE INDEX "form_responses_composite_idx" ON "public"."form_responses" USING "btree" ("client_id", "form_type", "response_date");



CREATE INDEX "form_responses_date_idx" ON "public"."form_responses" USING "btree" ("response_date");



CREATE INDEX "form_responses_submitted_idx" ON "public"."form_responses" USING "btree" ("submitted_at");



CREATE INDEX "form_responses_tenant_idx" ON "public"."form_responses" USING "btree" ("tenant_host");



CREATE INDEX "form_templates_form_type_idx" ON "public"."form_templates" USING "btree" ("form_type");



CREATE INDEX "form_templates_questions_gin_idx" ON "public"."form_templates" USING "gin" ("questions_config");



CREATE INDEX "form_templates_tenant_idx" ON "public"."form_templates" USING "btree" ("tenant_host");



CREATE INDEX "idx_client_form_configs_schedule" ON "public"."client_form_configs" USING "gin" ("schedule") WHERE ("form_type" = 'checkins'::"text");



CREATE INDEX "idx_exercise_log_sets_log_id" ON "public"."exercise_log_sets" USING "btree" ("exercise_log_id");



CREATE INDEX "idx_exercise_logs_training_date" ON "public"."exercise_logs" USING "btree" ("client_id", "training_date");



CREATE INDEX "idx_scheduled_session_exercise_sets_parent" ON "public"."scheduled_session_exercise_sets" USING "btree" ("scheduled_session_exercise_id");



CREATE INDEX "idx_scheduled_session_exercises_session" ON "public"."scheduled_session_exercises" USING "btree" ("scheduled_session_id");



CREATE INDEX "idx_scheduled_sessions_prescribed_by_client" ON "public"."scheduled_sessions" USING "btree" ("client_id", "scheduled_date") WHERE ("prescribed_by" = 'client'::"text");



CREATE INDEX "invitation_codes_code_idx" ON "public"."invitation_codes" USING "btree" ("code");



CREATE INDEX "invitation_codes_expires_idx" ON "public"."invitation_codes" USING "btree" ("expires_at");



CREATE INDEX "invitation_codes_status_idx" ON "public"."invitation_codes" USING "btree" ("status");



CREATE INDEX "messages_client_id_idx" ON "public"."messages" USING "btree" ("client_id");



CREATE INDEX "messages_created_at_idx" ON "public"."messages" USING "btree" ("created_at" DESC);



CREATE INDEX "messages_tenant_slug_idx" ON "public"."messages" USING "btree" ("tenant_slug");



CREATE INDEX "messages_unread_idx" ON "public"."messages" USING "btree" ("client_id", "read_at") WHERE ("read_at" IS NULL);



CREATE INDEX "microcycle_slots_microcycle_idx" ON "public"."microcycle_slots" USING "btree" ("microcycle_id");



CREATE INDEX "microcycles_client_program_idx" ON "public"."microcycles" USING "btree" ("client_program_id");



CREATE INDEX "microcycles_tenant_host_idx" ON "public"."microcycles" USING "btree" ("tenant_host");



CREATE INDEX "notifications_client_id_idx" ON "public"."notifications" USING "btree" ("client_id");



CREATE INDEX "notifications_created_at_idx" ON "public"."notifications" USING "btree" ("created_at" DESC);



CREATE INDEX "notifications_metadata_gin_idx" ON "public"."notifications" USING "gin" ("metadata");



CREATE INDEX "notifications_tenant_slug_idx" ON "public"."notifications" USING "btree" ("tenant_slug");



CREATE INDEX "notifications_trainer_id_idx" ON "public"."notifications" USING "btree" ("trainer_id");



CREATE INDEX "notifications_type_idx" ON "public"."notifications" USING "btree" ("type");



CREATE INDEX "notifications_unread_idx" ON "public"."notifications" USING "btree" ("client_id", "read_at") WHERE ("read_at" IS NULL);



CREATE INDEX "nutrition_days_order_idx" ON "public"."nutrition_days" USING "btree" ("nutrition_plan_id", "day_order");



CREATE INDEX "nutrition_days_plan_idx" ON "public"."nutrition_days" USING "btree" ("nutrition_plan_id");



CREATE INDEX "nutrition_days_tenant_idx" ON "public"."nutrition_days" USING "btree" ("tenant_host");



CREATE INDEX "nutrition_days_weekdays_idx" ON "public"."nutrition_days" USING "gin" ("weekdays");



CREATE INDEX "nutrition_ingredients_meal_idx" ON "public"."nutrition_ingredients" USING "btree" ("nutrition_meal_id");



CREATE INDEX "nutrition_ingredients_option_id_idx" ON "public"."nutrition_ingredients" USING "btree" ("option_id");



CREATE INDEX "nutrition_ingredients_option_order_idx" ON "public"."nutrition_ingredients" USING "btree" ("option_id", "ingredient_order");



CREATE INDEX "nutrition_ingredients_order_idx" ON "public"."nutrition_ingredients" USING "btree" ("nutrition_meal_id", "ingredient_order");



CREATE INDEX "nutrition_ingredients_tenant_idx" ON "public"."nutrition_ingredients" USING "btree" ("tenant_host");



CREATE INDEX "nutrition_meal_options_meal_id_idx" ON "public"."nutrition_meal_options" USING "btree" ("meal_id");



CREATE INDEX "nutrition_meal_options_meal_order_idx" ON "public"."nutrition_meal_options" USING "btree" ("meal_id", "option_order");



CREATE INDEX "nutrition_meals_day_idx" ON "public"."nutrition_meals" USING "btree" ("nutrition_day_id");



CREATE INDEX "nutrition_meals_order_idx" ON "public"."nutrition_meals" USING "btree" ("nutrition_day_id", "meal_order");



CREATE INDEX "nutrition_meals_tenant_idx" ON "public"."nutrition_meals" USING "btree" ("tenant_host");



CREATE INDEX "nutrition_option_selections_client_date_idx" ON "public"."nutrition_option_selections" USING "btree" ("client_id", "selected_date");



CREATE INDEX "nutrition_option_selections_meal_id_idx" ON "public"."nutrition_option_selections" USING "btree" ("meal_id");



CREATE INDEX "nutrition_plans_client_idx" ON "public"."nutrition_plans" USING "btree" ("client_id");



CREATE INDEX "nutrition_plans_is_template_idx" ON "public"."nutrition_plans" USING "btree" ("is_template", "trainer_id");



CREATE INDEX "nutrition_plans_status_idx" ON "public"."nutrition_plans" USING "btree" ("status");



CREATE INDEX "nutrition_plans_tenant_idx" ON "public"."nutrition_plans" USING "btree" ("tenant_host");



CREATE INDEX "nutrition_plans_trainer_idx" ON "public"."nutrition_plans" USING "btree" ("trainer_id");



CREATE INDEX "password_reset_otps_email_user_type_tenant_slug_idx" ON "public"."password_reset_otps" USING "btree" ("email", "user_type", "tenant_slug");



CREATE INDEX "password_reset_otps_expires_at_idx" ON "public"."password_reset_otps" USING "btree" ("expires_at");



CREATE INDEX "password_reset_otps_reset_token_idx" ON "public"."password_reset_otps" USING "btree" ("reset_token");



CREATE INDEX "personal_records_client_idx" ON "public"."personal_records" USING "btree" ("client_id");



CREATE INDEX "personal_records_exercise_idx" ON "public"."personal_records" USING "btree" ("exercise_id");



CREATE INDEX "personal_records_trainer_idx" ON "public"."personal_records" USING "btree" ("trainer_id");



CREATE INDEX "programs_metadata_type_idx" ON "public"."programs" USING "gin" ((("metadata" -> 'type'::"text")));



CREATE INDEX "programs_published_idx" ON "public"."programs" USING "btree" ("is_published");



CREATE INDEX "programs_tenant_idx" ON "public"."programs" USING "btree" ("tenant_host");



CREATE INDEX "programs_trainer_idx" ON "public"."programs" USING "btree" ("trainer_id");



CREATE INDEX "scheduled_session_exercise_sets_tenant_host_idx" ON "public"."scheduled_session_exercise_sets" USING "btree" ("tenant_host");



CREATE INDEX "scheduled_session_exercises_exercise_id_idx" ON "public"."scheduled_session_exercises" USING "btree" ("exercise_id");



CREATE INDEX "scheduled_session_exercises_tenant_host_idx" ON "public"."scheduled_session_exercises" USING "btree" ("tenant_host");



CREATE INDEX "scheduled_sessions_client_idx" ON "public"."scheduled_sessions" USING "btree" ("client_id");



CREATE INDEX "scheduled_sessions_date_idx" ON "public"."scheduled_sessions" USING "btree" ("scheduled_date");



CREATE INDEX "scheduled_sessions_status_idx" ON "public"."scheduled_sessions" USING "btree" ("status");



CREATE INDEX "scheduled_sessions_tenant_idx" ON "public"."scheduled_sessions" USING "btree" ("tenant_host");



CREATE INDEX "scheduled_sessions_trainer_idx" ON "public"."scheduled_sessions" USING "btree" ("trainer_id");



CREATE INDEX "session_exercises_exercise_idx" ON "public"."session_exercises" USING "btree" ("exercise_id");



CREATE INDEX "session_exercises_session_idx" ON "public"."session_exercises" USING "btree" ("session_id");



CREATE INDEX "sessions_metadata_day_idx" ON "public"."sessions" USING "gin" ((("metadata" -> 'day_of_week'::"text")));



CREATE INDEX "sessions_program_idx" ON "public"."sessions" USING "btree" ("program_id");



CREATE INDEX "sessions_tenant_idx" ON "public"."sessions" USING "btree" ("tenant_host");



CREATE INDEX "sessions_trainer_idx" ON "public"."sessions" USING "btree" ("trainer_id");



CREATE INDEX "supplement_inventory_archived_idx" ON "public"."supplement_inventory" USING "btree" ("is_archived");



CREATE INDEX "supplement_inventory_name_idx" ON "public"."supplement_inventory" USING "btree" ("name");



CREATE INDEX "supplement_inventory_tenant_idx" ON "public"."supplement_inventory" USING "btree" ("tenant_host");



CREATE INDEX "supplement_inventory_trainer_idx" ON "public"."supplement_inventory" USING "btree" ("trainer_id");



CREATE INDEX "tenants_features_gin" ON "public"."tenants" USING "gin" ("features");



CREATE UNIQUE INDEX "tenants_host_key" ON "public"."tenants" USING "btree" ("host");



CREATE INDEX "tenants_logo_url_idx" ON "public"."tenants" USING "btree" ("logo_url");



CREATE INDEX "tenants_status_idx" ON "public"."tenants" USING "btree" ("status");



CREATE INDEX "tenants_tables_gin" ON "public"."tenants" USING "gin" ("tables");



CREATE INDEX "tenants_trainer_id_idx" ON "public"."tenants" USING "btree" ("trainer_id");



CREATE INDEX "trainer_chart_templates_tenant_idx" ON "public"."trainer_chart_templates" USING "btree" ("tenant_host");



CREATE INDEX "trainer_chart_templates_updated_at_idx" ON "public"."trainer_chart_templates" USING "btree" ("updated_at" DESC);



CREATE INDEX "trainers_email_idx" ON "public"."trainers" USING "btree" ("email");



CREATE INDEX "trainers_invited_by_idx" ON "public"."trainers" USING "btree" ("invited_by");



CREATE INDEX "trainers_password_set_at_idx" ON "public"."trainers" USING "btree" ("password_set_at");



CREATE INDEX "trainers_status_idx" ON "public"."trainers" USING "btree" ("status");



CREATE INDEX "trainers_subscription_status_idx" ON "public"."trainers" USING "btree" ("subscription_status");



CREATE INDEX "trainers_tenant_host_idx" ON "public"."trainers" USING "btree" ("tenant_host");



CREATE OR REPLACE TRIGGER "set_updated_at_on_tenants" BEFORE UPDATE ON "public"."tenants" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_auto_confirm_admin_email" AFTER INSERT ON "public"."admin_users" FOR EACH ROW EXECUTE FUNCTION "public"."auto_confirm_admin_email"();



CREATE OR REPLACE TRIGGER "trigger_auto_confirm_trainer_email" AFTER INSERT ON "public"."trainers" FOR EACH ROW EXECUTE FUNCTION "public"."auto_confirm_trainer_email"();



CREATE OR REPLACE TRIGGER "trigger_delete_auth_user_on_admin_delete" BEFORE DELETE ON "public"."admin_users" FOR EACH ROW EXECUTE FUNCTION "public"."delete_auth_user_on_admin_delete"();



CREATE OR REPLACE TRIGGER "update_client_chart_configs_updated_at" BEFORE UPDATE ON "public"."client_chart_configs" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_client_form_configs_updated_at" BEFORE UPDATE ON "public"."client_form_configs" FOR EACH ROW EXECUTE FUNCTION "public"."update_forms_updated_at"();



CREATE OR REPLACE TRIGGER "update_client_goals_updated_at" BEFORE UPDATE ON "public"."client_goals" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_client_measurements_updated_at" BEFORE UPDATE ON "public"."client_measurements" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_client_neat_cards_updated_at" BEFORE UPDATE ON "public"."client_neat_cards" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_client_programs_updated_at" BEFORE UPDATE ON "public"."client_programs" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_client_supplement_assignments_updated_at" BEFORE UPDATE ON "public"."client_supplement_assignments" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_exercises_updated_at" BEFORE UPDATE ON "public"."exercises" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_form_responses_updated_at" BEFORE UPDATE ON "public"."form_responses" FOR EACH ROW EXECUTE FUNCTION "public"."update_forms_updated_at"();



CREATE OR REPLACE TRIGGER "update_form_templates_updated_at" BEFORE UPDATE ON "public"."form_templates" FOR EACH ROW EXECUTE FUNCTION "public"."update_forms_updated_at"();



CREATE OR REPLACE TRIGGER "update_messages_updated_at" BEFORE UPDATE ON "public"."messages" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_microcycles_updated_at" BEFORE UPDATE ON "public"."microcycles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_nutrition_days_updated_at" BEFORE UPDATE ON "public"."nutrition_days" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_nutrition_ingredients_updated_at" BEFORE UPDATE ON "public"."nutrition_ingredients" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_nutrition_meal_options_updated_at" BEFORE UPDATE ON "public"."nutrition_meal_options" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_nutrition_meals_updated_at" BEFORE UPDATE ON "public"."nutrition_meals" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_nutrition_plans_updated_at" BEFORE UPDATE ON "public"."nutrition_plans" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_programs_updated_at" BEFORE UPDATE ON "public"."programs" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_scheduled_sessions_updated_at" BEFORE UPDATE ON "public"."scheduled_sessions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_session_exercises_updated_at" BEFORE UPDATE ON "public"."session_exercises" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_sessions_updated_at" BEFORE UPDATE ON "public"."sessions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_supplement_inventory_updated_at" BEFORE UPDATE ON "public"."supplement_inventory" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_trainer_chart_templates_updated_at" BEFORE UPDATE ON "public"."trainer_chart_templates" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_trainers_updated_at" BEFORE UPDATE ON "public"."trainers" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."admin_users"
    ADD CONSTRAINT "admin_users_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_chart_configs"
    ADD CONSTRAINT "client_chart_configs_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_chart_configs"
    ADD CONSTRAINT "client_chart_configs_tenant_host_fkey" FOREIGN KEY ("tenant_host") REFERENCES "public"."tenants"("host") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_checkins"
    ADD CONSTRAINT "client_checkins_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_checkins"
    ADD CONSTRAINT "client_checkins_tenant_host_fkey" FOREIGN KEY ("tenant_host") REFERENCES "public"."tenants"("host") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_form_configs"
    ADD CONSTRAINT "client_form_configs_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_form_configs"
    ADD CONSTRAINT "client_form_configs_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."form_templates"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."client_form_configs"
    ADD CONSTRAINT "client_form_configs_tenant_host_fkey" FOREIGN KEY ("tenant_host") REFERENCES "public"."tenants"("host") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_goals"
    ADD CONSTRAINT "client_goals_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_goals"
    ADD CONSTRAINT "client_goals_tenant_host_fkey" FOREIGN KEY ("tenant_host") REFERENCES "public"."tenants"("host") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_measurements"
    ADD CONSTRAINT "client_measurements_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_measurements"
    ADD CONSTRAINT "client_measurements_tenant_host_fkey" FOREIGN KEY ("tenant_host") REFERENCES "public"."tenants"("host") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_measurements"
    ADD CONSTRAINT "client_measurements_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "public"."trainers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_neat_cards"
    ADD CONSTRAINT "client_neat_cards_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_neat_cards"
    ADD CONSTRAINT "client_neat_cards_tenant_host_fkey" FOREIGN KEY ("tenant_host") REFERENCES "public"."tenants"("host") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_programs"
    ADD CONSTRAINT "client_programs_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_programs"
    ADD CONSTRAINT "client_programs_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_programs"
    ADD CONSTRAINT "client_programs_tenant_host_fkey" FOREIGN KEY ("tenant_host") REFERENCES "public"."tenants"("host") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_programs"
    ADD CONSTRAINT "client_programs_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "public"."trainers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_step_tracking"
    ADD CONSTRAINT "client_step_tracking_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_step_tracking"
    ADD CONSTRAINT "client_step_tracking_tenant_host_fkey" FOREIGN KEY ("tenant_host") REFERENCES "public"."tenants"("host") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_supplement_assignments"
    ADD CONSTRAINT "client_supplement_assignments_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_supplement_assignments"
    ADD CONSTRAINT "client_supplement_assignments_supplement_id_fkey" FOREIGN KEY ("supplement_id") REFERENCES "public"."supplement_inventory"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."client_supplement_assignments"
    ADD CONSTRAINT "client_supplement_assignments_tenant_host_fkey" FOREIGN KEY ("tenant_host") REFERENCES "public"."tenants"("host") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_supplement_assignments"
    ADD CONSTRAINT "client_supplement_assignments_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "public"."trainers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_water_intake"
    ADD CONSTRAINT "client_water_intake_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_water_intake"
    ADD CONSTRAINT "client_water_intake_tenant_host_fkey" FOREIGN KEY ("tenant_host") REFERENCES "public"."tenants"("host") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_tenant_fkey" FOREIGN KEY ("tenant") REFERENCES "public"."trainers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."exercise_log_sets"
    ADD CONSTRAINT "exercise_log_sets_exercise_log_id_fkey" FOREIGN KEY ("exercise_log_id") REFERENCES "public"."exercise_logs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."exercise_logs"
    ADD CONSTRAINT "exercise_logs_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."exercise_logs"
    ADD CONSTRAINT "exercise_logs_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."exercise_logs"
    ADD CONSTRAINT "exercise_logs_scheduled_session_id_fkey" FOREIGN KEY ("scheduled_session_id") REFERENCES "public"."scheduled_sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."exercise_logs"
    ADD CONSTRAINT "exercise_logs_tenant_host_fkey" FOREIGN KEY ("tenant_host") REFERENCES "public"."tenants"("host") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."exercise_logs"
    ADD CONSTRAINT "exercise_logs_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "public"."trainers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."exercises"
    ADD CONSTRAINT "exercises_tenant_host_fkey" FOREIGN KEY ("tenant_host") REFERENCES "public"."tenants"("host") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."exercises"
    ADD CONSTRAINT "exercises_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "public"."trainers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."nutrition_ingredients"
    ADD CONSTRAINT "fk_ingredient_option" FOREIGN KEY ("option_id") REFERENCES "public"."nutrition_meal_options"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."form_responses"
    ADD CONSTRAINT "form_responses_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."form_responses"
    ADD CONSTRAINT "form_responses_tenant_host_fkey" FOREIGN KEY ("tenant_host") REFERENCES "public"."tenants"("host") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."form_templates"
    ADD CONSTRAINT "form_templates_tenant_host_fkey" FOREIGN KEY ("tenant_host") REFERENCES "public"."tenants"("host") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invitation_codes"
    ADD CONSTRAINT "invitation_codes_used_by_trainer_id_fkey" FOREIGN KEY ("used_by_trainer_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_tenant_slug_fkey" FOREIGN KEY ("tenant_slug") REFERENCES "public"."tenants"("host") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."microcycle_slots"
    ADD CONSTRAINT "microcycle_slots_microcycle_id_fkey" FOREIGN KEY ("microcycle_id") REFERENCES "public"."microcycles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."microcycle_slots"
    ADD CONSTRAINT "microcycle_slots_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."microcycles"
    ADD CONSTRAINT "microcycles_client_program_id_fkey" FOREIGN KEY ("client_program_id") REFERENCES "public"."client_programs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."microcycles"
    ADD CONSTRAINT "microcycles_tenant_host_fkey" FOREIGN KEY ("tenant_host") REFERENCES "public"."tenants"("host") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_tenant_slug_fkey" FOREIGN KEY ("tenant_slug") REFERENCES "public"."tenants"("host") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."nutrition_days"
    ADD CONSTRAINT "nutrition_days_nutrition_plan_id_fkey" FOREIGN KEY ("nutrition_plan_id") REFERENCES "public"."nutrition_plans"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."nutrition_days"
    ADD CONSTRAINT "nutrition_days_tenant_host_fkey" FOREIGN KEY ("tenant_host") REFERENCES "public"."tenants"("host") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."nutrition_ingredients"
    ADD CONSTRAINT "nutrition_ingredients_nutrition_meal_id_fkey" FOREIGN KEY ("nutrition_meal_id") REFERENCES "public"."nutrition_meals"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."nutrition_ingredients"
    ADD CONSTRAINT "nutrition_ingredients_tenant_host_fkey" FOREIGN KEY ("tenant_host") REFERENCES "public"."tenants"("host") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."nutrition_meal_options"
    ADD CONSTRAINT "nutrition_meal_options_meal_id_fkey" FOREIGN KEY ("meal_id") REFERENCES "public"."nutrition_meals"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."nutrition_meals"
    ADD CONSTRAINT "nutrition_meals_nutrition_day_id_fkey" FOREIGN KEY ("nutrition_day_id") REFERENCES "public"."nutrition_days"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."nutrition_meals"
    ADD CONSTRAINT "nutrition_meals_tenant_host_fkey" FOREIGN KEY ("tenant_host") REFERENCES "public"."tenants"("host") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."nutrition_option_selections"
    ADD CONSTRAINT "nutrition_option_selections_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."nutrition_option_selections"
    ADD CONSTRAINT "nutrition_option_selections_meal_id_fkey" FOREIGN KEY ("meal_id") REFERENCES "public"."nutrition_meals"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."nutrition_option_selections"
    ADD CONSTRAINT "nutrition_option_selections_option_id_fkey" FOREIGN KEY ("option_id") REFERENCES "public"."nutrition_meal_options"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."nutrition_plans"
    ADD CONSTRAINT "nutrition_plans_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."nutrition_plans"
    ADD CONSTRAINT "nutrition_plans_tenant_host_fkey" FOREIGN KEY ("tenant_host") REFERENCES "public"."tenants"("host") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."nutrition_plans"
    ADD CONSTRAINT "nutrition_plans_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "public"."trainers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."personal_records"
    ADD CONSTRAINT "personal_records_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."personal_records"
    ADD CONSTRAINT "personal_records_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."personal_records"
    ADD CONSTRAINT "personal_records_exercise_log_id_fkey" FOREIGN KEY ("exercise_log_id") REFERENCES "public"."exercise_logs"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."personal_records"
    ADD CONSTRAINT "personal_records_tenant_host_fkey" FOREIGN KEY ("tenant_host") REFERENCES "public"."tenants"("host") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."personal_records"
    ADD CONSTRAINT "personal_records_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "public"."trainers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."programs"
    ADD CONSTRAINT "programs_tenant_host_fkey" FOREIGN KEY ("tenant_host") REFERENCES "public"."tenants"("host") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."programs"
    ADD CONSTRAINT "programs_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "public"."trainers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."scheduled_session_exercise_sets"
    ADD CONSTRAINT "scheduled_session_exercise_se_scheduled_session_exercise_i_fkey" FOREIGN KEY ("scheduled_session_exercise_id") REFERENCES "public"."scheduled_session_exercises"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."scheduled_session_exercise_sets"
    ADD CONSTRAINT "scheduled_session_exercise_sets_tenant_host_fkey" FOREIGN KEY ("tenant_host") REFERENCES "public"."tenants"("host") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."scheduled_session_exercises"
    ADD CONSTRAINT "scheduled_session_exercises_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."scheduled_session_exercises"
    ADD CONSTRAINT "scheduled_session_exercises_scheduled_session_id_fkey" FOREIGN KEY ("scheduled_session_id") REFERENCES "public"."scheduled_sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."scheduled_session_exercises"
    ADD CONSTRAINT "scheduled_session_exercises_tenant_host_fkey" FOREIGN KEY ("tenant_host") REFERENCES "public"."tenants"("host") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."scheduled_sessions"
    ADD CONSTRAINT "scheduled_sessions_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."scheduled_sessions"
    ADD CONSTRAINT "scheduled_sessions_client_program_id_fkey" FOREIGN KEY ("client_program_id") REFERENCES "public"."client_programs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."scheduled_sessions"
    ADD CONSTRAINT "scheduled_sessions_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."scheduled_sessions"
    ADD CONSTRAINT "scheduled_sessions_tenant_host_fkey" FOREIGN KEY ("tenant_host") REFERENCES "public"."tenants"("host") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."scheduled_sessions"
    ADD CONSTRAINT "scheduled_sessions_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "public"."trainers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_exercises"
    ADD CONSTRAINT "session_exercises_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_exercises"
    ADD CONSTRAINT "session_exercises_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_exercises"
    ADD CONSTRAINT "session_exercises_tenant_host_fkey" FOREIGN KEY ("tenant_host") REFERENCES "public"."tenants"("host") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_tenant_host_fkey" FOREIGN KEY ("tenant_host") REFERENCES "public"."tenants"("host") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "public"."trainers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."supplement_inventory"
    ADD CONSTRAINT "supplement_inventory_tenant_host_fkey" FOREIGN KEY ("tenant_host") REFERENCES "public"."tenants"("host") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."supplement_inventory"
    ADD CONSTRAINT "supplement_inventory_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "public"."trainers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tenants"
    ADD CONSTRAINT "tenants_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "public"."trainers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trainer_chart_templates"
    ADD CONSTRAINT "trainer_chart_templates_tenant_host_fkey" FOREIGN KEY ("tenant_host") REFERENCES "public"."tenants"("host") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trainer_chart_templates"
    ADD CONSTRAINT "trainer_chart_templates_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "public"."trainers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trainers"
    ADD CONSTRAINT "trainers_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trainers"
    ADD CONSTRAINT "trainers_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "public"."admin_users"("id");



CREATE POLICY "Allow admins create trainers" ON "public"."trainers" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."admin_users"
  WHERE (("admin_users"."id" = "auth"."uid"()) AND ("admin_users"."status" = 'active'::"text")))));



CREATE POLICY "Allow admins read all trainers" ON "public"."trainers" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."admin_users"
  WHERE (("admin_users"."id" = "auth"."uid"()) AND ("admin_users"."status" = 'active'::"text")))));



CREATE POLICY "Allow admins update trainers" ON "public"."trainers" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."admin_users"
  WHERE (("admin_users"."id" = "auth"."uid"()) AND ("admin_users"."status" = 'active'::"text")))));



CREATE POLICY "Allow anon insert tenants" ON "public"."tenants" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "Allow anon insert trainers" ON "public"."trainers" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "Allow anon read active invitations" ON "public"."invitation_codes" FOR SELECT TO "anon" USING ((("status" = 'active'::"text") AND ("expires_at" > "now"())));



CREATE POLICY "Allow anon read tenant metadata" ON "public"."tenants" FOR SELECT TO "anon" USING (("status" = ANY (ARRAY['active'::"public"."tenant_status", 'inactive'::"public"."tenant_status"])));



CREATE POLICY "Allow anon read trainers" ON "public"."trainers" FOR SELECT TO "anon" USING (true);



COMMENT ON POLICY "Allow anon read trainers" ON "public"."trainers" IS 'Allow anon access - authentication handled at API level via custom JWT sessions';



CREATE POLICY "Allow anon to manage client measurements" ON "public"."client_measurements" TO "anon" USING (true) WITH CHECK (true);



CREATE POLICY "Allow anon to manage client programs" ON "public"."client_programs" TO "anon" USING (true) WITH CHECK (true);



CREATE POLICY "Allow anon to manage clients" ON "public"."clients" TO "anon" USING (true) WITH CHECK (true);



CREATE POLICY "Allow anon to manage exercise log sets" ON "public"."exercise_log_sets" TO "anon" USING (true) WITH CHECK (true);



CREATE POLICY "Allow anon to manage exercise logs" ON "public"."exercise_logs" TO "anon" USING (true) WITH CHECK (true);



CREATE POLICY "Allow anon to manage exercises" ON "public"."exercises" TO "anon" USING (true) WITH CHECK (true);



CREATE POLICY "Allow anon to manage nutrition days" ON "public"."nutrition_days" TO "anon" USING (true) WITH CHECK (true);



CREATE POLICY "Allow anon to manage nutrition ingredients" ON "public"."nutrition_ingredients" TO "anon" USING (true) WITH CHECK (true);



CREATE POLICY "Allow anon to manage nutrition meals" ON "public"."nutrition_meals" TO "anon" USING (true) WITH CHECK (true);



CREATE POLICY "Allow anon to manage nutrition plans" ON "public"."nutrition_plans" TO "anon" USING (true) WITH CHECK (true);



CREATE POLICY "Allow anon to manage personal records" ON "public"."personal_records" TO "anon" USING (true) WITH CHECK (true);



CREATE POLICY "Allow anon to manage programs" ON "public"."programs" TO "anon" USING (true) WITH CHECK (true);



CREATE POLICY "Allow anon to manage scheduled session exercise sets" ON "public"."scheduled_session_exercise_sets" TO "anon" USING (true) WITH CHECK (true);



CREATE POLICY "Allow anon to manage scheduled session exercises" ON "public"."scheduled_session_exercises" TO "anon" USING (true) WITH CHECK (true);



CREATE POLICY "Allow anon to manage scheduled sessions" ON "public"."scheduled_sessions" TO "anon" USING (true) WITH CHECK (true);



CREATE POLICY "Allow anon to manage session exercises" ON "public"."session_exercises" TO "anon" USING (true) WITH CHECK (true);



CREATE POLICY "Allow anon to manage sessions" ON "public"."sessions" TO "anon" USING (true) WITH CHECK (true);



CREATE POLICY "Allow anon to read trainers" ON "public"."trainers" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Allow anon to update trainers" ON "public"."trainers" FOR UPDATE TO "anon" USING (true) WITH CHECK (true);



CREATE POLICY "Allow anon update invitation codes" ON "public"."invitation_codes" FOR UPDATE TO "anon" USING ((("status" = 'active'::"text") AND ("expires_at" > "now"())));



CREATE POLICY "Allow anon update invitation usage" ON "public"."invitation_codes" FOR UPDATE TO "anon" USING ((("status" = 'active'::"text") AND ("expires_at" > "now"())));



CREATE POLICY "Allow anon update tenants" ON "public"."tenants" FOR UPDATE TO "anon" USING (true);



CREATE POLICY "Allow trainers read own data" ON "public"."trainers" FOR SELECT TO "authenticated" USING (("id" = "auth"."uid"()));



CREATE POLICY "Allow trainers update own data" ON "public"."trainers" FOR UPDATE TO "authenticated" USING (("id" = "auth"."uid"()));



CREATE POLICY "Anon can manage NEAT cards" ON "public"."client_neat_cards" TO "anon" USING (true) WITH CHECK (true);



CREATE POLICY "Anon can read NEAT cards" ON "public"."client_neat_cards" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Authenticated users can manage client measurements" ON "public"."client_measurements" TO "authenticated" USING (true) WITH CHECK (true);



COMMENT ON POLICY "Authenticated users can manage client measurements" ON "public"."client_measurements" IS 'Allows authenticated trainers to manage client measurements. Application verifies trainer owns the data.';



CREATE POLICY "Authenticated users can manage client programs" ON "public"."client_programs" TO "authenticated" USING (true) WITH CHECK (true);



COMMENT ON POLICY "Authenticated users can manage client programs" ON "public"."client_programs" IS 'Allows authenticated trainers to manage client program assignments. Application verifies trainer owns the data.';



CREATE POLICY "Authenticated users can manage exercise logs" ON "public"."exercise_logs" TO "authenticated" USING (true) WITH CHECK (true);



COMMENT ON POLICY "Authenticated users can manage exercise logs" ON "public"."exercise_logs" IS 'Allows authenticated trainers to manage exercise logs. Application verifies trainer owns the data.';



CREATE POLICY "Authenticated users can manage exercises" ON "public"."exercises" TO "authenticated" USING (true) WITH CHECK (true);



COMMENT ON POLICY "Authenticated users can manage exercises" ON "public"."exercises" IS 'Allows authenticated trainers to manage exercises. Application verifies trainer owns the data.';



CREATE POLICY "Authenticated users can manage personal records" ON "public"."personal_records" TO "authenticated" USING (true) WITH CHECK (true);



COMMENT ON POLICY "Authenticated users can manage personal records" ON "public"."personal_records" IS 'Allows authenticated trainers to manage personal records. Application verifies trainer owns the data.';



CREATE POLICY "Authenticated users can manage programs" ON "public"."programs" TO "authenticated" USING (true) WITH CHECK (true);



COMMENT ON POLICY "Authenticated users can manage programs" ON "public"."programs" IS 'Allows authenticated trainers to manage programs. Application verifies trainer owns the data.';



CREATE POLICY "Authenticated users can manage scheduled sessions" ON "public"."scheduled_sessions" TO "authenticated" USING (true) WITH CHECK (true);



COMMENT ON POLICY "Authenticated users can manage scheduled sessions" ON "public"."scheduled_sessions" IS 'Allows authenticated trainers to manage scheduled sessions. Application verifies trainer owns the data.';



CREATE POLICY "Authenticated users can manage session exercises" ON "public"."session_exercises" TO "authenticated" USING (true) WITH CHECK (true);



COMMENT ON POLICY "Authenticated users can manage session exercises" ON "public"."session_exercises" IS 'Allows authenticated trainers to manage session exercises. Application verifies trainer owns the data.';



CREATE POLICY "Authenticated users can manage sessions" ON "public"."sessions" TO "authenticated" USING (true) WITH CHECK (true);



COMMENT ON POLICY "Authenticated users can manage sessions" ON "public"."sessions" IS 'Allows authenticated trainers to manage sessions. Application verifies trainer owns the data.';



CREATE POLICY "Trainers can manage NEAT cards" ON "public"."client_neat_cards" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Trainers can manage nutrition days" ON "public"."nutrition_days" TO "authenticated", "anon" USING (true) WITH CHECK (true);



CREATE POLICY "Trainers can manage nutrition ingredients" ON "public"."nutrition_ingredients" TO "authenticated", "anon" USING (true) WITH CHECK (true);



CREATE POLICY "Trainers can manage nutrition meal options" ON "public"."nutrition_meal_options" TO "authenticated", "anon" USING (true) WITH CHECK (true);



COMMENT ON POLICY "Trainers can manage nutrition meal options" ON "public"."nutrition_meal_options" IS 'Permissive access for API routes using anon or Supabase auth; authorization enforced in application layer.';



CREATE POLICY "Trainers can manage nutrition meals" ON "public"."nutrition_meals" TO "authenticated", "anon" USING (true) WITH CHECK (true);



CREATE POLICY "Trainers can manage nutrition option selections" ON "public"."nutrition_option_selections" TO "authenticated", "anon" USING (true) WITH CHECK (true);



COMMENT ON POLICY "Trainers can manage nutrition option selections" ON "public"."nutrition_option_selections" IS 'Permissive access for API routes using anon; authorization enforced in application layer.';



CREATE POLICY "Trainers can manage nutrition plans" ON "public"."nutrition_plans" TO "authenticated", "anon" USING (true) WITH CHECK (true);



CREATE POLICY "Trainers can manage supplement assignments" ON "public"."client_supplement_assignments" TO "authenticated", "anon" USING (true) WITH CHECK (true);



CREATE POLICY "Trainers can manage supplement inventory" ON "public"."supplement_inventory" TO "authenticated", "anon" USING (true) WITH CHECK (true);



ALTER TABLE "public"."admin_users" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "admin_users_anon_delete" ON "public"."admin_users" FOR DELETE TO "anon" USING (true);



CREATE POLICY "admin_users_anon_insert" ON "public"."admin_users" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "admin_users_anon_select" ON "public"."admin_users" FOR SELECT TO "anon" USING (true);



CREATE POLICY "admin_users_anon_update" ON "public"."admin_users" FOR UPDATE TO "anon" USING (true) WITH CHECK (true);



CREATE POLICY "admin_users_authenticated_select" ON "public"."admin_users" FOR SELECT TO "authenticated" USING (("id" = "auth"."uid"()));



CREATE POLICY "admin_users_authenticated_update" ON "public"."admin_users" FOR UPDATE TO "authenticated" USING (("id" = "auth"."uid"())) WITH CHECK (("id" = "auth"."uid"()));



CREATE POLICY "all_reading_rights" ON "public"."clients" USING (true) WITH CHECK (true);



ALTER TABLE "public"."chart_config_audit" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "chart_config_audit_app_layer" ON "public"."chart_config_audit" TO "authenticated", "anon" USING (true) WITH CHECK (true);



COMMENT ON POLICY "chart_config_audit_app_layer" ON "public"."chart_config_audit" IS 'Permissive RLS — audit writes happen from server routes only; reads are gated by app-layer admin check.';



ALTER TABLE "public"."client_chart_configs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "client_chart_configs_app_layer" ON "public"."client_chart_configs" TO "authenticated", "anon" USING (true) WITH CHECK (true);



COMMENT ON POLICY "client_chart_configs_app_layer" ON "public"."client_chart_configs" IS 'Permissive RLS — authorization enforced in /api/charts/* routes.';



ALTER TABLE "public"."client_form_configs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "client_form_configs_anon_access" ON "public"."client_form_configs" USING (true) WITH CHECK (true);



ALTER TABLE "public"."client_measurements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."client_neat_cards" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."client_programs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."client_supplement_assignments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."clients" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."exercise_log_sets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."exercise_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."exercises" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."form_responses" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "form_responses_anon_access" ON "public"."form_responses" USING (true) WITH CHECK (true);



ALTER TABLE "public"."form_templates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "form_templates_anon_access" ON "public"."form_templates" USING (true) WITH CHECK (true);



ALTER TABLE "public"."invitation_codes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "messages_allow_anon_all" ON "public"."messages" TO "anon" USING (true) WITH CHECK (true);



COMMENT ON POLICY "messages_allow_anon_all" ON "public"."messages" IS 'Permissive policy - authentication handled at API level via custom JWT sessions';



ALTER TABLE "public"."microcycle_slots" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "microcycle_slots_app_layer" ON "public"."microcycle_slots" TO "authenticated", "anon" USING (true) WITH CHECK (true);



COMMENT ON POLICY "microcycle_slots_app_layer" ON "public"."microcycle_slots" IS 'Permissive RLS — authorization enforced in API routes via parent microcycle ownership check.';



ALTER TABLE "public"."microcycles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "microcycles_app_layer" ON "public"."microcycles" TO "authenticated", "anon" USING (true) WITH CHECK (true);



COMMENT ON POLICY "microcycles_app_layer" ON "public"."microcycles" IS 'Permissive RLS — authorization enforced in /api/trainer/clients/:id/microcycle and /api/client/microcycle routes. See migration 083 for the same pattern.';



ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notifications_anon_access" ON "public"."notifications" USING (true) WITH CHECK (true);



ALTER TABLE "public"."nutrition_days" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."nutrition_ingredients" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."nutrition_meal_options" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."nutrition_meals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."nutrition_option_selections" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."nutrition_plans" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."password_reset_otps" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "password_reset_otps_anon_insert" ON "public"."password_reset_otps" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "password_reset_otps_anon_select" ON "public"."password_reset_otps" FOR SELECT TO "anon" USING (true);



CREATE POLICY "password_reset_otps_anon_update" ON "public"."password_reset_otps" FOR UPDATE TO "anon" USING (true) WITH CHECK (true);



ALTER TABLE "public"."personal_records" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."programs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."scheduled_session_exercise_sets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."scheduled_session_exercises" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."scheduled_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."session_exercises" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."supplement_inventory" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tenants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."trainer_chart_templates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "trainer_chart_templates_app_layer" ON "public"."trainer_chart_templates" TO "authenticated", "anon" USING (true) WITH CHECK (true);



COMMENT ON POLICY "trainer_chart_templates_app_layer" ON "public"."trainer_chart_templates" IS 'Permissive RLS — authorization enforced in /api/charts/* routes. See migration 074 for the same pattern.';



ALTER TABLE "public"."trainers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "trainers_anon_delete" ON "public"."trainers" FOR DELETE TO "anon" USING (true);



CREATE POLICY "trainers_anon_insert" ON "public"."trainers" FOR INSERT TO "anon" WITH CHECK (true);



COMMENT ON POLICY "trainers_anon_insert" ON "public"."trainers" IS 'Allow admin API to create new trainers using anon key';



CREATE POLICY "trainers_anon_select" ON "public"."trainers" FOR SELECT TO "anon" USING (true);



COMMENT ON POLICY "trainers_anon_select" ON "public"."trainers" IS 'Allow admin API to read trainers using anon key';



CREATE POLICY "trainers_anon_update" ON "public"."trainers" FOR UPDATE TO "anon" USING (true) WITH CHECK (true);



COMMENT ON POLICY "trainers_anon_update" ON "public"."trainers" IS 'Allow API routes to update trainer records using anon key - required for setup-password and other trainer management APIs';





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."messages";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."notifications";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































GRANT ALL ON FUNCTION "public"."auto_confirm_admin_email"() TO "anon";
GRANT ALL ON FUNCTION "public"."auto_confirm_admin_email"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_confirm_admin_email"() TO "service_role";



GRANT ALL ON FUNCTION "public"."auto_confirm_trainer_email"() TO "anon";
GRANT ALL ON FUNCTION "public"."auto_confirm_trainer_email"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_confirm_trainer_email"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_otp_rate_limit"("p_email" "text", "p_user_type" "text", "p_window_minutes" integer, "p_max_requests" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."check_otp_rate_limit"("p_email" "text", "p_user_type" "text", "p_window_minutes" integer, "p_max_requests" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_otp_rate_limit"("p_email" "text", "p_user_type" "text", "p_window_minutes" integer, "p_max_requests" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_expired_otps"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_expired_otps"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_expired_otps"() TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_auth_user_on_admin_delete"() TO "anon";
GRANT ALL ON FUNCTION "public"."delete_auth_user_on_admin_delete"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_auth_user_on_admin_delete"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_checkin_schedule"("p_config_schedule" "jsonb", "p_template_schedule" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."get_checkin_schedule"("p_config_schedule" "jsonb", "p_template_schedule" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_checkin_schedule"("p_config_schedule" "jsonb", "p_template_schedule" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_client_checkin_streak"("p_client_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."get_client_checkin_streak"("p_client_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_client_checkin_streak"("p_client_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_or_create_client_form_config"("p_client_id" bigint, "p_form_type" "text", "p_tenant_host" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_or_create_client_form_config"("p_client_id" bigint, "p_form_type" "text", "p_tenant_host" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_or_create_client_form_config"("p_client_id" bigint, "p_form_type" "text", "p_tenant_host" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_tenant_host_for_client"("p_client_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."get_tenant_host_for_client"("p_client_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_tenant_host_for_client"("p_client_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_trainer_deletion_impact"("trainer_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_trainer_deletion_impact"("trainer_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_trainer_deletion_impact"("trainer_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."replace_scheduled_session_overrides"("p_tenant_host" "text", "p_client_id" bigint, "p_trainer_id" "uuid", "p_scheduled_date" "date", "p_session_id" "uuid", "p_exercises" "jsonb", "p_sets" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."replace_scheduled_session_overrides"("p_tenant_host" "text", "p_client_id" bigint, "p_trainer_id" "uuid", "p_scheduled_date" "date", "p_session_id" "uuid", "p_exercises" "jsonb", "p_sets" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."replace_scheduled_session_overrides"("p_tenant_host" "text", "p_client_id" bigint, "p_trainer_id" "uuid", "p_scheduled_date" "date", "p_session_id" "uuid", "p_exercises" "jsonb", "p_sets" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_forms_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_forms_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_forms_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."upsert_scheduled_session"("p_tenant_host" "text", "p_client_id" bigint, "p_trainer_id" "uuid", "p_session_id" "uuid", "p_scheduled_date" "date", "p_caller_role" "text", "p_status" "text", "p_client_program_id" "uuid", "p_metadata" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."upsert_scheduled_session"("p_tenant_host" "text", "p_client_id" bigint, "p_trainer_id" "uuid", "p_session_id" "uuid", "p_scheduled_date" "date", "p_caller_role" "text", "p_status" "text", "p_client_program_id" "uuid", "p_metadata" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."upsert_scheduled_session"("p_tenant_host" "text", "p_client_id" bigint, "p_trainer_id" "uuid", "p_session_id" "uuid", "p_scheduled_date" "date", "p_caller_role" "text", "p_status" "text", "p_client_program_id" "uuid", "p_metadata" "jsonb") TO "service_role";


















GRANT ALL ON TABLE "public"."admin_users" TO "anon";
GRANT ALL ON TABLE "public"."admin_users" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_users" TO "service_role";



GRANT ALL ON TABLE "public"."chart_config_audit" TO "anon";
GRANT ALL ON TABLE "public"."chart_config_audit" TO "authenticated";
GRANT ALL ON TABLE "public"."chart_config_audit" TO "service_role";



GRANT ALL ON TABLE "public"."client_chart_configs" TO "anon";
GRANT ALL ON TABLE "public"."client_chart_configs" TO "authenticated";
GRANT ALL ON TABLE "public"."client_chart_configs" TO "service_role";



GRANT ALL ON TABLE "public"."client_checkins" TO "anon";
GRANT ALL ON TABLE "public"."client_checkins" TO "authenticated";
GRANT ALL ON TABLE "public"."client_checkins" TO "service_role";



GRANT ALL ON TABLE "public"."client_form_configs" TO "anon";
GRANT ALL ON TABLE "public"."client_form_configs" TO "authenticated";
GRANT ALL ON TABLE "public"."client_form_configs" TO "service_role";



GRANT ALL ON TABLE "public"."client_goals" TO "anon";
GRANT ALL ON TABLE "public"."client_goals" TO "authenticated";
GRANT ALL ON TABLE "public"."client_goals" TO "service_role";



GRANT ALL ON TABLE "public"."client_measurements" TO "anon";
GRANT ALL ON TABLE "public"."client_measurements" TO "authenticated";
GRANT ALL ON TABLE "public"."client_measurements" TO "service_role";



GRANT ALL ON TABLE "public"."client_neat_cards" TO "anon";
GRANT ALL ON TABLE "public"."client_neat_cards" TO "authenticated";
GRANT ALL ON TABLE "public"."client_neat_cards" TO "service_role";



GRANT ALL ON TABLE "public"."client_programs" TO "anon";
GRANT ALL ON TABLE "public"."client_programs" TO "authenticated";
GRANT ALL ON TABLE "public"."client_programs" TO "service_role";



GRANT ALL ON TABLE "public"."client_step_tracking" TO "anon";
GRANT ALL ON TABLE "public"."client_step_tracking" TO "authenticated";
GRANT ALL ON TABLE "public"."client_step_tracking" TO "service_role";



GRANT ALL ON TABLE "public"."client_supplement_assignments" TO "anon";
GRANT ALL ON TABLE "public"."client_supplement_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."client_supplement_assignments" TO "service_role";



GRANT ALL ON TABLE "public"."client_water_intake" TO "anon";
GRANT ALL ON TABLE "public"."client_water_intake" TO "authenticated";
GRANT ALL ON TABLE "public"."client_water_intake" TO "service_role";



GRANT ALL ON TABLE "public"."clients" TO "anon";
GRANT ALL ON TABLE "public"."clients" TO "authenticated";
GRANT ALL ON TABLE "public"."clients" TO "service_role";



GRANT ALL ON SEQUENCE "public"."clients_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."clients_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."clients_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."exercise_log_sets" TO "anon";
GRANT ALL ON TABLE "public"."exercise_log_sets" TO "authenticated";
GRANT ALL ON TABLE "public"."exercise_log_sets" TO "service_role";



GRANT ALL ON TABLE "public"."exercise_logs" TO "anon";
GRANT ALL ON TABLE "public"."exercise_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."exercise_logs" TO "service_role";



GRANT ALL ON TABLE "public"."exercises" TO "anon";
GRANT ALL ON TABLE "public"."exercises" TO "authenticated";
GRANT ALL ON TABLE "public"."exercises" TO "service_role";



GRANT ALL ON TABLE "public"."form_responses" TO "anon";
GRANT ALL ON TABLE "public"."form_responses" TO "authenticated";
GRANT ALL ON TABLE "public"."form_responses" TO "service_role";



GRANT ALL ON TABLE "public"."form_templates" TO "anon";
GRANT ALL ON TABLE "public"."form_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."form_templates" TO "service_role";



GRANT ALL ON TABLE "public"."invitation_codes" TO "anon";
GRANT ALL ON TABLE "public"."invitation_codes" TO "authenticated";
GRANT ALL ON TABLE "public"."invitation_codes" TO "service_role";



GRANT ALL ON TABLE "public"."messages" TO "anon";
GRANT ALL ON TABLE "public"."messages" TO "authenticated";
GRANT ALL ON TABLE "public"."messages" TO "service_role";



GRANT ALL ON TABLE "public"."microcycle_slots" TO "anon";
GRANT ALL ON TABLE "public"."microcycle_slots" TO "authenticated";
GRANT ALL ON TABLE "public"."microcycle_slots" TO "service_role";



GRANT ALL ON TABLE "public"."microcycles" TO "anon";
GRANT ALL ON TABLE "public"."microcycles" TO "authenticated";
GRANT ALL ON TABLE "public"."microcycles" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."nutrition_days" TO "anon";
GRANT ALL ON TABLE "public"."nutrition_days" TO "authenticated";
GRANT ALL ON TABLE "public"."nutrition_days" TO "service_role";



GRANT ALL ON TABLE "public"."nutrition_ingredients" TO "anon";
GRANT ALL ON TABLE "public"."nutrition_ingredients" TO "authenticated";
GRANT ALL ON TABLE "public"."nutrition_ingredients" TO "service_role";



GRANT ALL ON TABLE "public"."nutrition_meal_options" TO "anon";
GRANT ALL ON TABLE "public"."nutrition_meal_options" TO "authenticated";
GRANT ALL ON TABLE "public"."nutrition_meal_options" TO "service_role";



GRANT ALL ON TABLE "public"."nutrition_meals" TO "anon";
GRANT ALL ON TABLE "public"."nutrition_meals" TO "authenticated";
GRANT ALL ON TABLE "public"."nutrition_meals" TO "service_role";



GRANT ALL ON TABLE "public"."nutrition_option_selections" TO "anon";
GRANT ALL ON TABLE "public"."nutrition_option_selections" TO "authenticated";
GRANT ALL ON TABLE "public"."nutrition_option_selections" TO "service_role";



GRANT ALL ON TABLE "public"."nutrition_plans" TO "anon";
GRANT ALL ON TABLE "public"."nutrition_plans" TO "authenticated";
GRANT ALL ON TABLE "public"."nutrition_plans" TO "service_role";



GRANT ALL ON TABLE "public"."password_reset_otps" TO "anon";
GRANT ALL ON TABLE "public"."password_reset_otps" TO "authenticated";
GRANT ALL ON TABLE "public"."password_reset_otps" TO "service_role";



GRANT ALL ON TABLE "public"."personal_records" TO "anon";
GRANT ALL ON TABLE "public"."personal_records" TO "authenticated";
GRANT ALL ON TABLE "public"."personal_records" TO "service_role";



GRANT ALL ON TABLE "public"."programs" TO "anon";
GRANT ALL ON TABLE "public"."programs" TO "authenticated";
GRANT ALL ON TABLE "public"."programs" TO "service_role";



GRANT ALL ON TABLE "public"."scheduled_session_exercise_sets" TO "anon";
GRANT ALL ON TABLE "public"."scheduled_session_exercise_sets" TO "authenticated";
GRANT ALL ON TABLE "public"."scheduled_session_exercise_sets" TO "service_role";



GRANT ALL ON TABLE "public"."scheduled_session_exercises" TO "anon";
GRANT ALL ON TABLE "public"."scheduled_session_exercises" TO "authenticated";
GRANT ALL ON TABLE "public"."scheduled_session_exercises" TO "service_role";



GRANT ALL ON TABLE "public"."scheduled_sessions" TO "anon";
GRANT ALL ON TABLE "public"."scheduled_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."scheduled_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."session_exercises" TO "anon";
GRANT ALL ON TABLE "public"."session_exercises" TO "authenticated";
GRANT ALL ON TABLE "public"."session_exercises" TO "service_role";



GRANT ALL ON TABLE "public"."sessions" TO "anon";
GRANT ALL ON TABLE "public"."sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."sessions" TO "service_role";



GRANT ALL ON TABLE "public"."supplement_inventory" TO "anon";
GRANT ALL ON TABLE "public"."supplement_inventory" TO "authenticated";
GRANT ALL ON TABLE "public"."supplement_inventory" TO "service_role";



GRANT ALL ON TABLE "public"."tenant_events" TO "anon";
GRANT ALL ON TABLE "public"."tenant_events" TO "authenticated";
GRANT ALL ON TABLE "public"."tenant_events" TO "service_role";



GRANT ALL ON TABLE "public"."tenants" TO "anon";
GRANT ALL ON TABLE "public"."tenants" TO "authenticated";
GRANT ALL ON TABLE "public"."tenants" TO "service_role";



GRANT ALL ON TABLE "public"."trainer_chart_templates" TO "anon";
GRANT ALL ON TABLE "public"."trainer_chart_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."trainer_chart_templates" TO "service_role";



GRANT ALL ON TABLE "public"."trainers" TO "anon";
GRANT ALL ON TABLE "public"."trainers" TO "authenticated";
GRANT ALL ON TABLE "public"."trainers" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































