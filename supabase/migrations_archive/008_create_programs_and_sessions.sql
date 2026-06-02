-- Create training programs and session templates
-- All tables are tenant-scoped with RLS
-- Training programs (templates created by trainers)
CREATE TABLE IF NOT EXISTS programs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_host TEXT NOT NULL REFERENCES tenants(host) ON DELETE CASCADE,
    trainer_id UUID NOT NULL REFERENCES trainer_profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    duration_weeks INTEGER,
    difficulty_level TEXT CHECK (
        difficulty_level IN ('beginner', 'intermediate', 'advanced')
    ),
    is_template BOOLEAN DEFAULT true,
    is_published BOOLEAN DEFAULT false,
    tags TEXT [],
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT name_not_empty CHECK (name != '')
);
-- Client program assignments
CREATE TABLE IF NOT EXISTS client_programs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_host TEXT NOT NULL REFERENCES tenants(host) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES client_profiles(id) ON DELETE CASCADE,
    program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    trainer_id UUID NOT NULL REFERENCES trainer_profiles(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE,
    status TEXT NOT NULL DEFAULT 'active' CHECK (
        status IN ('active', 'completed', 'paused', 'cancelled')
    ),
    progress_percentage INTEGER DEFAULT 0 CHECK (
        progress_percentage >= 0
        AND progress_percentage <= 100
    ),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT valid_date_range CHECK (
        end_date IS NULL
        OR end_date >= start_date
    )
);
-- Session templates (workouts within programs)
CREATE TABLE IF NOT EXISTS sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_host TEXT NOT NULL REFERENCES tenants(host) ON DELETE CASCADE,
    program_id UUID REFERENCES programs(id) ON DELETE CASCADE,
    trainer_id UUID NOT NULL REFERENCES trainer_profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    session_order INTEGER,
    duration_minutes INTEGER,
    session_type TEXT CHECK (
        session_type IN (
            'strength',
            'cardio',
            'flexibility',
            'sports',
            'recovery',
            'other'
        )
    ),
    intensity_level TEXT CHECK (intensity_level IN ('low', 'moderate', 'high')),
    equipment_needed TEXT [],
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT name_not_empty CHECK (name != '')
);
-- Scheduled sessions (actual calendar events for clients)
CREATE TABLE IF NOT EXISTS scheduled_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_host TEXT NOT NULL REFERENCES tenants(host) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES client_profiles(id) ON DELETE CASCADE,
    trainer_id UUID NOT NULL REFERENCES trainer_profiles(id) ON DELETE CASCADE,
    session_id UUID REFERENCES sessions(id) ON DELETE
    SET NULL,
        client_program_id UUID REFERENCES client_programs(id) ON DELETE CASCADE,
        scheduled_date DATE NOT NULL,
        scheduled_time TIME,
        duration_minutes INTEGER,
        status TEXT NOT NULL DEFAULT 'scheduled' CHECK (
            status IN (
                'scheduled',
                'completed',
                'missed',
                'cancelled',
                'rescheduled'
            )
        ),
        completion_date TIMESTAMPTZ,
        client_notes TEXT,
        trainer_notes TEXT,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- Indexes
CREATE INDEX IF NOT EXISTS programs_tenant_idx ON programs(tenant_host);
CREATE INDEX IF NOT EXISTS programs_trainer_idx ON programs(trainer_id);
CREATE INDEX IF NOT EXISTS programs_published_idx ON programs(is_published);
CREATE INDEX IF NOT EXISTS client_programs_tenant_idx ON client_programs(tenant_host);
CREATE INDEX IF NOT EXISTS client_programs_client_idx ON client_programs(client_id);
CREATE INDEX IF NOT EXISTS client_programs_trainer_idx ON client_programs(trainer_id);
CREATE INDEX IF NOT EXISTS client_programs_status_idx ON client_programs(status);
CREATE INDEX IF NOT EXISTS sessions_tenant_idx ON sessions(tenant_host);
CREATE INDEX IF NOT EXISTS sessions_program_idx ON sessions(program_id);
CREATE INDEX IF NOT EXISTS sessions_trainer_idx ON sessions(trainer_id);
CREATE INDEX IF NOT EXISTS scheduled_sessions_tenant_idx ON scheduled_sessions(tenant_host);
CREATE INDEX IF NOT EXISTS scheduled_sessions_client_idx ON scheduled_sessions(client_id);
CREATE INDEX IF NOT EXISTS scheduled_sessions_trainer_idx ON scheduled_sessions(trainer_id);
CREATE INDEX IF NOT EXISTS scheduled_sessions_date_idx ON scheduled_sessions(scheduled_date);
CREATE INDEX IF NOT EXISTS scheduled_sessions_status_idx ON scheduled_sessions(status);
-- Triggers
CREATE TRIGGER update_programs_updated_at BEFORE
UPDATE ON programs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_client_programs_updated_at BEFORE
UPDATE ON client_programs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_sessions_updated_at BEFORE
UPDATE ON sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_scheduled_sessions_updated_at BEFORE
UPDATE ON scheduled_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- Row Level Security
ALTER TABLE programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_sessions ENABLE ROW LEVEL SECURITY;
-- RLS Policies for programs
CREATE POLICY "Trainers can view their programs" ON programs FOR
SELECT USING (trainer_id = auth.uid());
CREATE POLICY "Trainers can create programs" ON programs FOR
INSERT WITH CHECK (trainer_id = auth.uid());
CREATE POLICY "Trainers can update their programs" ON programs FOR
UPDATE USING (trainer_id = auth.uid());
CREATE POLICY "Trainers can delete their programs" ON programs FOR DELETE USING (trainer_id = auth.uid());
-- Clients can view programs assigned to them
CREATE POLICY "Clients can view their assigned programs" ON programs FOR
SELECT USING (
        EXISTS (
            SELECT 1
            FROM client_programs cp
            WHERE cp.program_id = programs.id
                AND cp.client_id = auth.uid()
        )
    );
-- RLS Policies for client_programs
CREATE POLICY "Trainers can manage client program assignments" ON client_programs FOR ALL USING (trainer_id = auth.uid());
CREATE POLICY "Clients can view their program assignments" ON client_programs FOR
SELECT USING (client_id = auth.uid());
-- RLS Policies for sessions
CREATE POLICY "Trainers can manage their sessions" ON sessions FOR ALL USING (trainer_id = auth.uid());
CREATE POLICY "Clients can view sessions in their programs" ON sessions FOR
SELECT USING (
        EXISTS (
            SELECT 1
            FROM client_programs cp
            WHERE cp.program_id = sessions.program_id
                AND cp.client_id = auth.uid()
        )
    );
-- RLS Policies for scheduled_sessions
CREATE POLICY "Trainers can manage their scheduled sessions" ON scheduled_sessions FOR ALL USING (trainer_id = auth.uid());
CREATE POLICY "Clients can view their scheduled sessions" ON scheduled_sessions FOR
SELECT USING (client_id = auth.uid());
CREATE POLICY "Clients can update their session completion" ON scheduled_sessions FOR
UPDATE USING (client_id = auth.uid()) WITH CHECK (
        client_id = auth.uid()
        AND (
            OLD.status = NEW.status
            OR NEW.status IN ('completed', 'missed')
        )
    );
-- Comments
COMMENT ON TABLE programs IS 'Training program templates created by trainers';
COMMENT ON TABLE client_programs IS 'Programs assigned to specific clients';
COMMENT ON TABLE sessions IS 'Session templates (workouts) within programs';
COMMENT ON TABLE scheduled_sessions IS 'Calendar events for client workout sessions';