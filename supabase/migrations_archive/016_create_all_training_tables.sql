-- Complete migration for training system
-- Creates all necessary tables for programs, sessions, and exercises
-- =====================================================
-- PROGRAMS AND CLIENT ASSIGNMENTS
-- =====================================================
-- Training programs (templates created by trainers)
CREATE TABLE IF NOT EXISTS programs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_host TEXT NOT NULL REFERENCES tenants(host) ON DELETE CASCADE,
    trainer_id UUID NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
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
    client_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    trainer_id UUID NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
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
-- =====================================================
-- SESSIONS
-- =====================================================
-- Session templates (workouts within programs)
CREATE TABLE IF NOT EXISTS sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_host TEXT NOT NULL REFERENCES tenants(host) ON DELETE CASCADE,
    program_id UUID REFERENCES programs(id) ON DELETE CASCADE,
    trainer_id UUID NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
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
    client_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    trainer_id UUID NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
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
-- =====================================================
-- EXERCISES
-- =====================================================
-- Exercise library
CREATE TABLE IF NOT EXISTS exercises (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_host TEXT NOT NULL REFERENCES tenants(host) ON DELETE CASCADE,
    trainer_id UUID NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT CHECK (
        category IN (
            'strength',
            'cardio',
            'flexibility',
            'balance',
            'plyometric',
            'olympic',
            'powerlifting',
            'bodyweight',
            'other'
        )
    ),
    muscle_groups TEXT [],
    equipment TEXT [],
    difficulty_level TEXT CHECK (
        difficulty_level IN ('beginner', 'intermediate', 'advanced')
    ),
    video_url TEXT,
    image_url TEXT,
    instructions TEXT [],
    tips TEXT [],
    is_public BOOLEAN DEFAULT false,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT name_not_empty CHECK (name != '')
);
-- Session exercises (exercises within a session template)
CREATE TABLE IF NOT EXISTS session_exercises (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_host TEXT NOT NULL REFERENCES tenants(host) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
    exercise_order INTEGER NOT NULL,
    sets INTEGER,
    reps TEXT,
    duration_seconds INTEGER,
    rest_seconds INTEGER,
    weight_kg DECIMAL,
    distance_meters DECIMAL,
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_session_exercise_order UNIQUE (session_id, exercise_order)
);
-- Exercise performance logs (client completion data)
CREATE TABLE IF NOT EXISTS exercise_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_host TEXT NOT NULL REFERENCES tenants(host) ON DELETE CASCADE,
    client_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    trainer_id UUID NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
    scheduled_session_id UUID REFERENCES scheduled_sessions(id) ON DELETE CASCADE,
    exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
    completed_at TIMESTAMPTZ DEFAULT NOW(),
    sets_completed INTEGER,
    reps_completed TEXT,
    weight_kg DECIMAL,
    duration_seconds INTEGER,
    distance_meters DECIMAL,
    perceived_exertion INTEGER CHECK (
        perceived_exertion >= 1
        AND perceived_exertion <= 10
    ),
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
-- =====================================================
-- MEASUREMENTS AND RECORDS
-- =====================================================
-- Client measurements (weight, body composition, etc.)
CREATE TABLE IF NOT EXISTS client_measurements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_host TEXT NOT NULL REFERENCES tenants(host) ON DELETE CASCADE,
    client_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    trainer_id UUID NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
    measurement_date DATE NOT NULL DEFAULT CURRENT_DATE,
    weight_kg DECIMAL,
    height_cm DECIMAL,
    body_fat_percentage DECIMAL,
    muscle_mass_kg DECIMAL,
    waist_cm DECIMAL,
    chest_cm DECIMAL,
    hips_cm DECIMAL,
    bicep_cm DECIMAL,
    thigh_cm DECIMAL,
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- Personal records tracking
CREATE TABLE IF NOT EXISTS personal_records (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_host TEXT NOT NULL REFERENCES tenants(host) ON DELETE CASCADE,
    client_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    trainer_id UUID NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
    exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
    record_type TEXT NOT NULL CHECK (
        record_type IN (
            'max_weight',
            'max_reps',
            'max_distance',
            'best_time'
        )
    ),
    value DECIMAL NOT NULL,
    unit TEXT NOT NULL,
    achieved_date DATE NOT NULL DEFAULT CURRENT_DATE,
    exercise_log_id UUID REFERENCES exercise_logs(id) ON DELETE
    SET NULL,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT unique_client_exercise_record_type UNIQUE (client_id, exercise_id, record_type)
);
-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS programs_tenant_idx ON programs(tenant_host);
CREATE INDEX IF NOT EXISTS programs_trainer_idx ON programs(trainer_id);
CREATE INDEX IF NOT EXISTS programs_published_idx ON programs(is_published);
CREATE INDEX IF NOT EXISTS programs_metadata_type_idx ON programs USING GIN ((metadata->'type'));
CREATE INDEX IF NOT EXISTS client_programs_tenant_idx ON client_programs(tenant_host);
CREATE INDEX IF NOT EXISTS client_programs_client_idx ON client_programs(client_id);
CREATE INDEX IF NOT EXISTS client_programs_trainer_idx ON client_programs(trainer_id);
CREATE INDEX IF NOT EXISTS client_programs_status_idx ON client_programs(status);
CREATE INDEX IF NOT EXISTS sessions_tenant_idx ON sessions(tenant_host);
CREATE INDEX IF NOT EXISTS sessions_program_idx ON sessions(program_id);
CREATE INDEX IF NOT EXISTS sessions_trainer_idx ON sessions(trainer_id);
CREATE INDEX IF NOT EXISTS sessions_metadata_day_idx ON sessions USING GIN ((metadata->'day_of_week'));
CREATE INDEX IF NOT EXISTS scheduled_sessions_tenant_idx ON scheduled_sessions(tenant_host);
CREATE INDEX IF NOT EXISTS scheduled_sessions_client_idx ON scheduled_sessions(client_id);
CREATE INDEX IF NOT EXISTS scheduled_sessions_trainer_idx ON scheduled_sessions(trainer_id);
CREATE INDEX IF NOT EXISTS scheduled_sessions_date_idx ON scheduled_sessions(scheduled_date);
CREATE INDEX IF NOT EXISTS scheduled_sessions_status_idx ON scheduled_sessions(status);
CREATE INDEX IF NOT EXISTS exercises_tenant_idx ON exercises(tenant_host);
CREATE INDEX IF NOT EXISTS exercises_trainer_idx ON exercises(trainer_id);
CREATE INDEX IF NOT EXISTS exercises_category_idx ON exercises(category);
CREATE INDEX IF NOT EXISTS exercises_public_idx ON exercises(is_public);
CREATE INDEX IF NOT EXISTS session_exercises_session_idx ON session_exercises(session_id);
CREATE INDEX IF NOT EXISTS session_exercises_exercise_idx ON session_exercises(exercise_id);
CREATE INDEX IF NOT EXISTS exercise_logs_client_idx ON exercise_logs(client_id);
CREATE INDEX IF NOT EXISTS exercise_logs_trainer_idx ON exercise_logs(trainer_id);
CREATE INDEX IF NOT EXISTS exercise_logs_exercise_idx ON exercise_logs(exercise_id);
CREATE INDEX IF NOT EXISTS exercise_logs_session_idx ON exercise_logs(scheduled_session_id);
CREATE INDEX IF NOT EXISTS exercise_logs_completed_idx ON exercise_logs(completed_at);
CREATE INDEX IF NOT EXISTS client_measurements_client_idx ON client_measurements(client_id);
CREATE INDEX IF NOT EXISTS client_measurements_trainer_idx ON client_measurements(trainer_id);
CREATE INDEX IF NOT EXISTS client_measurements_date_idx ON client_measurements(measurement_date);
CREATE INDEX IF NOT EXISTS personal_records_client_idx ON personal_records(client_id);
CREATE INDEX IF NOT EXISTS personal_records_trainer_idx ON personal_records(trainer_id);
CREATE INDEX IF NOT EXISTS personal_records_exercise_idx ON personal_records(exercise_id);
-- =====================================================
-- TRIGGERS
-- =====================================================
CREATE TRIGGER update_programs_updated_at BEFORE
UPDATE ON programs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_client_programs_updated_at BEFORE
UPDATE ON client_programs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_sessions_updated_at BEFORE
UPDATE ON sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_scheduled_sessions_updated_at BEFORE
UPDATE ON scheduled_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_exercises_updated_at BEFORE
UPDATE ON exercises FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_session_exercises_updated_at BEFORE
UPDATE ON session_exercises FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_client_measurements_updated_at BEFORE
UPDATE ON client_measurements FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================
ALTER TABLE programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal_records ENABLE ROW LEVEL SECURITY;
-- RLS Policies for programs
-- Allow all authenticated users (trainers) to manage programs
-- Application logic ensures they only access their own data
CREATE POLICY "Trainers can manage programs" ON programs FOR ALL TO authenticated USING (true) WITH CHECK (true);
-- Note: Client RLS policies removed because clients table uses bigint IDs, not auth.uid() UUIDs
-- Client access will be controlled at the application level
-- RLS Policies for client_programs
CREATE POLICY "Trainers can manage client program assignments" ON client_programs FOR ALL USING (trainer_id = auth.uid());
-- RLS Policies for sessions
CREATE POLICY "Trainers can manage their sessions" ON sessions FOR ALL USING (trainer_id = auth.uid());
-- RLS Policies for scheduled_sessions
CREATE POLICY "Trainers can manage their scheduled sessions" ON scheduled_sessions FOR ALL USING (trainer_id = auth.uid());
-- RLS Policies for exercises
CREATE POLICY "Trainers can manage their exercises" ON exercises FOR ALL USING (trainer_id = auth.uid());
-- RLS Policies for session_exercises
CREATE POLICY "Trainers can manage session exercises" ON session_exercises FOR ALL USING (
    EXISTS (
        SELECT 1
        FROM sessions
        WHERE sessions.id = session_exercises.session_id
            AND sessions.trainer_id = auth.uid()
    )
);
-- RLS Policies for exercise_logs
CREATE POLICY "Trainers can manage exercise logs" ON exercise_logs FOR ALL USING (trainer_id = auth.uid());
-- RLS Policies for client_measurements
CREATE POLICY "Trainers can manage client measurements" ON client_measurements FOR ALL USING (trainer_id = auth.uid());
-- RLS Policies for personal_records
CREATE POLICY "Trainers can manage client personal records" ON personal_records FOR ALL USING (trainer_id = auth.uid());
-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON TABLE programs IS 'Training program templates created by trainers';
COMMENT ON TABLE client_programs IS 'Programs assigned to specific clients';
COMMENT ON TABLE sessions IS 'Session templates (workouts) within programs';
COMMENT ON TABLE scheduled_sessions IS 'Calendar events for client workout sessions';
COMMENT ON TABLE exercises IS 'Exercise library with videos, instructions, and metadata';
COMMENT ON TABLE session_exercises IS 'Exercises assigned to session templates with sets/reps/weights';
COMMENT ON TABLE exercise_logs IS 'Client performance logs for completed exercises';
COMMENT ON TABLE client_measurements IS 'Body measurements and composition tracking';
COMMENT ON TABLE personal_records IS 'Client personal records for exercises';
COMMENT ON COLUMN session_exercises.metadata IS 'JSONB field storing: tempo (string), training_system (string), rest_description (string), and other custom exercise parameters';
COMMENT ON COLUMN sessions.metadata IS 'JSONB field storing: day_of_week (string) for default scheduling, and other session-specific parameters';
COMMENT ON COLUMN programs.metadata IS 'JSONB field storing: type (string), division (string), sessions_per_week (number), and other program-specific parameters';