-- Create NEAT (Non-Exercise Activity Thermogenesis) goals table
-- Allows trainers to set daily step and activity goals per weekday for clients
-- Supports both 'active' and 'break' day designations with multiple metrics
-- =====================================================
-- CLIENT NEAT GOALS
-- =====================================================
CREATE TABLE IF NOT EXISTS client_neat_goals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    tenant_host TEXT NOT NULL REFERENCES tenants(host) ON DELETE CASCADE,
    weekday INTEGER NOT NULL CHECK (
        weekday >= 0
        AND weekday <= 6
    ),
    day_type TEXT NOT NULL DEFAULT 'active' CHECK (day_type IN ('active', 'break')),
    steps_goal INTEGER CHECK (
        steps_goal IS NULL
        OR steps_goal >= 0
    ),
    active_minutes_goal INTEGER CHECK (
        active_minutes_goal IS NULL
        OR active_minutes_goal >= 0
    ),
    distance_goal_km NUMERIC(5, 2) CHECK (
        distance_goal_km IS NULL
        OR distance_goal_km >= 0
    ),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    -- Ensure only one goal per client per weekday
    CONSTRAINT unique_client_weekday UNIQUE (client_id, tenant_host, weekday)
);
-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS client_neat_goals_tenant_idx ON client_neat_goals(tenant_host);
CREATE INDEX IF NOT EXISTS client_neat_goals_client_idx ON client_neat_goals(client_id, tenant_host);
CREATE INDEX IF NOT EXISTS client_neat_goals_weekday_idx ON client_neat_goals(tenant_host, weekday);
-- =====================================================
-- TRIGGERS
-- =====================================================
CREATE TRIGGER update_client_neat_goals_updated_at BEFORE
UPDATE ON client_neat_goals FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================
ALTER TABLE client_neat_goals ENABLE ROW LEVEL SECURITY;
-- =====================================================
-- RLS POLICIES
-- =====================================================
-- Trainers can manage NEAT goals (authorization handled at application level)
CREATE POLICY "Trainers can manage NEAT goals" ON client_neat_goals FOR ALL TO authenticated USING (true) WITH CHECK (true);
-- Allow anon access for client-side reads (authorization handled at application level)
CREATE POLICY "Anon can read NEAT goals" ON client_neat_goals FOR
SELECT TO anon USING (true);
-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON TABLE client_neat_goals IS 'NEAT goals for clients - step counts, active minutes, and distance targets per weekday';
COMMENT ON COLUMN client_neat_goals.weekday IS 'Day of week: 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday';
COMMENT ON COLUMN client_neat_goals.day_type IS 'Type of day: active (higher goals) or break (lower goals/rest)';
COMMENT ON COLUMN client_neat_goals.steps_goal IS 'Daily step count goal';
COMMENT ON COLUMN client_neat_goals.active_minutes_goal IS 'Daily active minutes goal';
COMMENT ON COLUMN client_neat_goals.distance_goal_km IS 'Daily distance goal in kilometers';