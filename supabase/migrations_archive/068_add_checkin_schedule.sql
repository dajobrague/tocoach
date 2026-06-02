-- Check-in schedule: per-client and template defaults, validation, and resolution helper
-- =====================================================

-- 1. Columns (NULL = use resolution chain / system defaults)
ALTER TABLE client_form_configs
ADD COLUMN IF NOT EXISTS schedule JSONB DEFAULT NULL;

ALTER TABLE form_templates
ADD COLUMN IF NOT EXISTS default_schedule JSONB DEFAULT NULL;

-- 2. Backfill existing check-in configs with explicit default schedule
UPDATE client_form_configs
SET schedule = '{"frequency":"weekly","times_per_week":1,"days_of_week":[1],"time":"12:00","timezone":"Europe/Madrid","custom_name":"Checkin semanal","grace_period_hours":48,"enabled":true}'::jsonb
WHERE form_type = 'checkins' AND schedule IS NULL;

-- 3. Validate schedule shape when present
ALTER TABLE client_form_configs
ADD CONSTRAINT client_form_configs_schedule_valid CHECK (
    schedule IS NULL
    OR (
        schedule ? 'frequency'
        AND schedule ? 'days_of_week'
        AND schedule ? 'time'
        AND schedule ? 'timezone'
        AND (schedule->>'frequency') IN ('weekly', 'biweekly', 'custom')
        AND jsonb_typeof(schedule->'days_of_week') = 'array'
        AND jsonb_array_length(schedule->'days_of_week') > 0
    )
);

-- 4. Effective schedule: client → template → system default
CREATE OR REPLACE FUNCTION public.get_checkin_schedule(
    p_config_schedule JSONB,
    p_template_schedule JSONB
)
RETURNS JSONB
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
    SELECT COALESCE(
        p_config_schedule,
        p_template_schedule,
        '{"frequency":"weekly","times_per_week":1,"days_of_week":[1],"time":"12:00","timezone":"Europe/Madrid","custom_name":"Checkin semanal","grace_period_hours":48,"enabled":true}'::jsonb
    );
$$;

GRANT EXECUTE ON FUNCTION public.get_checkin_schedule(JSONB, JSONB) TO anon, authenticated;

CREATE INDEX idx_client_form_configs_schedule
ON client_form_configs USING gin (schedule)
WHERE form_type = 'checkins';
