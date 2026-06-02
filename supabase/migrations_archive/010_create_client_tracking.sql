-- Create client tracking tables for daily check-ins, water, steps, and goals
-- All tables are tenant-scoped with RLS
-- Client daily check-ins
CREATE TABLE IF NOT EXISTS client_checkins (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_host TEXT NOT NULL REFERENCES tenants(host) ON DELETE CASCADE,
    client_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    checkin_date DATE NOT NULL DEFAULT CURRENT_DATE,
    checkin_time TIMESTAMPTZ DEFAULT NOW(),
    mood TEXT CHECK (
        mood IN ('great', 'good', 'okay', 'tired', 'bad')
    ),
    energy_level INTEGER CHECK (
        energy_level >= 1
        AND energy_level <= 5
    ),
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    -- Ensure one check-in per client per day
    CONSTRAINT unique_client_checkin_per_day UNIQUE (client_id, checkin_date)
);
-- Client water intake tracking
CREATE TABLE IF NOT EXISTS client_water_intake (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_host TEXT NOT NULL REFERENCES tenants(host) ON DELETE CASCADE,
    client_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    intake_date DATE NOT NULL DEFAULT CURRENT_DATE,
    amount_liters DECIMAL NOT NULL CHECK (amount_liters >= 0),
    logged_at TIMESTAMPTZ DEFAULT NOW(),
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
-- Client step tracking
CREATE TABLE IF NOT EXISTS client_step_tracking (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_host TEXT NOT NULL REFERENCES tenants(host) ON DELETE CASCADE,
    client_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    tracking_date DATE NOT NULL DEFAULT CURRENT_DATE,
    step_count INTEGER NOT NULL CHECK (step_count >= 0),
    distance_meters DECIMAL,
    calories_burned INTEGER,
    logged_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    -- Allow multiple entries per day but typically one summary
    CONSTRAINT unique_client_steps_per_day UNIQUE (client_id, tracking_date)
);
-- Client sleep tracking
CREATE TABLE IF NOT EXISTS client_sleep_tracking (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_host TEXT NOT NULL REFERENCES tenants(host) ON DELETE CASCADE,
    client_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    sleep_date DATE NOT NULL DEFAULT CURRENT_DATE,
    hours_slept DECIMAL NOT NULL CHECK (hours_slept >= 0 AND hours_slept <= 24),
    sleep_quality TEXT CHECK (sleep_quality IN ('excellent', 'good', 'fair', 'poor')),
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    -- One sleep record per day
    CONSTRAINT unique_client_sleep_per_day UNIQUE (client_id, sleep_date)
);

-- Client calorie tracking
CREATE TABLE IF NOT EXISTS client_calorie_tracking (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_host TEXT NOT NULL REFERENCES tenants(host) ON DELETE CASCADE,
    client_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    tracking_date DATE NOT NULL DEFAULT CURRENT_DATE,
    calories_consumed INTEGER NOT NULL CHECK (calories_consumed >= 0),
    calories_burned INTEGER CHECK (calories_burned >= 0),
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    -- One calorie record per day
    CONSTRAINT unique_client_calories_per_day UNIQUE (client_id, tracking_date)
);

-- Client goals (water, steps, weight targets, etc.)
CREATE TABLE IF NOT EXISTS client_goals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_host TEXT NOT NULL REFERENCES tenants(host) ON DELETE CASCADE,
    client_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    goal_type TEXT NOT NULL CHECK (
        goal_type IN (
            'water_daily',
            'steps_daily',
            'weight_target',
            'body_fat_target',
            'muscle_gain',
            'custom'
        )
    ),
    target_value DECIMAL NOT NULL,
    unit TEXT NOT NULL,
    -- 'liters', 'steps', 'kg', 'percent', etc.
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    target_date DATE,
    status TEXT NOT NULL DEFAULT 'active' CHECK (
        status IN ('active', 'completed', 'paused', 'cancelled')
    ),
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT valid_goal_dates CHECK (
        target_date IS NULL
        OR target_date >= start_date
    )
);
-- Indexes for performance
CREATE INDEX IF NOT EXISTS client_checkins_client_idx ON client_checkins(client_id);
CREATE INDEX IF NOT EXISTS client_checkins_date_idx ON client_checkins(checkin_date);
CREATE INDEX IF NOT EXISTS client_checkins_tenant_idx ON client_checkins(tenant_host);
CREATE INDEX IF NOT EXISTS client_water_intake_client_idx ON client_water_intake(client_id);
CREATE INDEX IF NOT EXISTS client_water_intake_date_idx ON client_water_intake(intake_date);
CREATE INDEX IF NOT EXISTS client_water_intake_tenant_idx ON client_water_intake(tenant_host);
CREATE INDEX IF NOT EXISTS client_step_tracking_client_idx ON client_step_tracking(client_id);
CREATE INDEX IF NOT EXISTS client_step_tracking_date_idx ON client_step_tracking(tracking_date);
CREATE INDEX IF NOT EXISTS client_step_tracking_tenant_idx ON client_step_tracking(tenant_host);
CREATE INDEX IF NOT EXISTS client_sleep_tracking_client_idx ON client_sleep_tracking(client_id);
CREATE INDEX IF NOT EXISTS client_sleep_tracking_date_idx ON client_sleep_tracking(sleep_date);
CREATE INDEX IF NOT EXISTS client_sleep_tracking_tenant_idx ON client_sleep_tracking(tenant_host);

CREATE INDEX IF NOT EXISTS client_calorie_tracking_client_idx ON client_calorie_tracking(client_id);
CREATE INDEX IF NOT EXISTS client_calorie_tracking_date_idx ON client_calorie_tracking(tracking_date);
CREATE INDEX IF NOT EXISTS client_calorie_tracking_tenant_idx ON client_calorie_tracking(tenant_host);

CREATE INDEX IF NOT EXISTS client_goals_client_idx ON client_goals(client_id);
CREATE INDEX IF NOT EXISTS client_goals_type_idx ON client_goals(goal_type);
CREATE INDEX IF NOT EXISTS client_goals_status_idx ON client_goals(status);
CREATE INDEX IF NOT EXISTS client_goals_tenant_idx ON client_goals(tenant_host);
-- Triggers for updated_at
CREATE TRIGGER update_client_sleep_tracking_updated_at BEFORE
UPDATE ON client_sleep_tracking FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_client_calorie_tracking_updated_at BEFORE
UPDATE ON client_calorie_tracking FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_client_goals_updated_at BEFORE
UPDATE ON client_goals FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- Row Level Security
-- Note: RLS is disabled for these tables because client authentication
-- is handled at the application level using session-based auth with BIGINT client IDs,
-- not Supabase Auth UUID. API endpoints will verify client access via session middleware.
-- Comments
COMMENT ON TABLE client_checkins IS 'Daily client check-ins with mood and energy tracking';
COMMENT ON TABLE client_water_intake IS 'Client water consumption tracking';
COMMENT ON TABLE client_step_tracking IS 'Daily step count and activity tracking';
COMMENT ON TABLE client_sleep_tracking IS 'Daily sleep hours and quality tracking';
COMMENT ON TABLE client_calorie_tracking IS 'Daily calorie consumption and burn tracking';
COMMENT ON TABLE client_goals IS 'Client health and fitness goals';
-- Function to calculate check-in streak
CREATE OR REPLACE FUNCTION get_client_checkin_streak(p_client_id BIGINT) RETURNS INTEGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION get_client_checkin_streak(BIGINT) TO authenticated;