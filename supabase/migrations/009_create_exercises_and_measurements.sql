-- Create exercise library and client measurements
-- Exercises are tenant-scoped and can be shared across programs
-- Exercise library
CREATE TABLE IF NOT EXISTS exercises (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_host TEXT NOT NULL REFERENCES tenants(host) ON DELETE CASCADE,
    trainer_id UUID NOT NULL REFERENCES trainer_profiles(id) ON DELETE CASCADE,
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
    -- Can be "10-12", "AMRAP", etc.
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
    client_id UUID NOT NULL REFERENCES client_profiles(id) ON DELETE CASCADE,
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
-- Client measurements (weight, body composition, etc.)
CREATE TABLE IF NOT EXISTS client_measurements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_host TEXT NOT NULL REFERENCES tenants(host) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES client_profiles(id) ON DELETE CASCADE,
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
    client_id UUID NOT NULL REFERENCES client_profiles(id) ON DELETE CASCADE,
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
-- Indexes
CREATE INDEX IF NOT EXISTS exercises_tenant_idx ON exercises(tenant_host);
CREATE INDEX IF NOT EXISTS exercises_trainer_idx ON exercises(trainer_id);
CREATE INDEX IF NOT EXISTS exercises_category_idx ON exercises(category);
CREATE INDEX IF NOT EXISTS exercises_public_idx ON exercises(is_public);
CREATE INDEX IF NOT EXISTS session_exercises_session_idx ON session_exercises(session_id);
CREATE INDEX IF NOT EXISTS session_exercises_exercise_idx ON session_exercises(exercise_id);
CREATE INDEX IF NOT EXISTS exercise_logs_client_idx ON exercise_logs(client_id);
CREATE INDEX IF NOT EXISTS exercise_logs_exercise_idx ON exercise_logs(exercise_id);
CREATE INDEX IF NOT EXISTS exercise_logs_session_idx ON exercise_logs(scheduled_session_id);
CREATE INDEX IF NOT EXISTS exercise_logs_completed_idx ON exercise_logs(completed_at);
CREATE INDEX IF NOT EXISTS client_measurements_client_idx ON client_measurements(client_id);
CREATE INDEX IF NOT EXISTS client_measurements_date_idx ON client_measurements(measurement_date);
CREATE INDEX IF NOT EXISTS personal_records_client_idx ON personal_records(client_id);
CREATE INDEX IF NOT EXISTS personal_records_exercise_idx ON personal_records(exercise_id);
-- Triggers
CREATE TRIGGER update_exercises_updated_at BEFORE
UPDATE ON exercises FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_session_exercises_updated_at BEFORE
UPDATE ON session_exercises FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_client_measurements_updated_at BEFORE
UPDATE ON client_measurements FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- Row Level Security
ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal_records ENABLE ROW LEVEL SECURITY;
-- RLS Policies for exercises
CREATE POLICY "Trainers can manage their exercises" ON exercises FOR ALL USING (trainer_id = auth.uid());
CREATE POLICY "Clients can view exercises in their sessions" ON exercises FOR
SELECT USING (
        EXISTS (
            SELECT 1
            FROM scheduled_sessions ss
                JOIN sessions s ON ss.session_id = s.id
                JOIN session_exercises se ON se.session_id = s.id
            WHERE se.exercise_id = exercises.id
                AND ss.client_id = auth.uid()
        )
    );
-- RLS Policies for session_exercises
CREATE POLICY "Trainers can manage session exercises" ON session_exercises FOR ALL USING (
    EXISTS (
        SELECT 1
        FROM sessions
        WHERE sessions.id = session_exercises.session_id
            AND sessions.trainer_id = auth.uid()
    )
);
CREATE POLICY "Clients can view session exercises" ON session_exercises FOR
SELECT USING (
        EXISTS (
            SELECT 1
            FROM scheduled_sessions ss
            WHERE ss.session_id = session_exercises.session_id
                AND ss.client_id = auth.uid()
        )
    );
-- RLS Policies for exercise_logs
CREATE POLICY "Clients can manage their exercise logs" ON exercise_logs FOR ALL USING (client_id = auth.uid());
CREATE POLICY "Trainers can view their clients' exercise logs" ON exercise_logs FOR
SELECT USING (
        EXISTS (
            SELECT 1
            FROM trainer_clients tc
            WHERE tc.client_id = exercise_logs.client_id
                AND tc.trainer_id = auth.uid()
                AND tc.relationship_status = 'active'
        )
    );
-- RLS Policies for client_measurements
CREATE POLICY "Clients can manage their measurements" ON client_measurements FOR ALL USING (client_id = auth.uid());
CREATE POLICY "Trainers can view their clients' measurements" ON client_measurements FOR
SELECT USING (
        EXISTS (
            SELECT 1
            FROM trainer_clients tc
            WHERE tc.client_id = client_measurements.client_id
                AND tc.trainer_id = auth.uid()
                AND tc.relationship_status = 'active'
        )
    );
-- RLS Policies for personal_records
CREATE POLICY "Clients can manage their personal records" ON personal_records FOR ALL USING (client_id = auth.uid());
CREATE POLICY "Trainers can view their clients' personal records" ON personal_records FOR
SELECT USING (
        EXISTS (
            SELECT 1
            FROM trainer_clients tc
            WHERE tc.client_id = personal_records.client_id
                AND tc.trainer_id = auth.uid()
                AND tc.relationship_status = 'active'
        )
    );
-- Comments
COMMENT ON TABLE exercises IS 'Exercise library with videos, instructions, and metadata';
COMMENT ON TABLE session_exercises IS 'Exercises assigned to session templates with sets/reps/weights';
COMMENT ON TABLE exercise_logs IS 'Client performance logs for completed exercises';
COMMENT ON TABLE client_measurements IS 'Body measurements and composition tracking';
COMMENT ON TABLE personal_records IS 'Client personal records for exercises';