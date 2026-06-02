-- Create client profiles and trainer-client relationships
-- Clients use Supabase Auth just like trainers, with tenant scoping
-- Client profiles table
CREATE TABLE IF NOT EXISTS client_profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    tenant_host TEXT NOT NULL REFERENCES tenants(host) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT NOT NULL,
    phone TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    onboarding_completed BOOLEAN DEFAULT false,
    profile_image_url TEXT,
    timezone TEXT DEFAULT 'America/Chicago',
    date_of_birth DATE,
    emergency_contact JSONB,
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_login_at TIMESTAMPTZ,
    -- Constraints
    CONSTRAINT email_format CHECK (
        email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
    ),
    CONSTRAINT valid_timezone CHECK (timezone IS NOT NULL)
);
-- Trainer-client relationships
CREATE TABLE IF NOT EXISTS trainer_clients (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    trainer_id UUID NOT NULL REFERENCES trainer_profiles(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES client_profiles(id) ON DELETE CASCADE,
    tenant_host TEXT NOT NULL REFERENCES tenants(host) ON DELETE CASCADE,
    relationship_status TEXT NOT NULL DEFAULT 'active' CHECK (
        relationship_status IN ('active', 'inactive', 'pending')
    ),
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    -- Constraints
    CONSTRAINT unique_trainer_client_per_tenant UNIQUE (trainer_id, client_id, tenant_host),
    CONSTRAINT valid_date_range CHECK (
        end_date IS NULL
        OR end_date >= start_date
    )
);
-- Indexes for performance
CREATE INDEX IF NOT EXISTS client_profiles_tenant_host_idx ON client_profiles(tenant_host);
CREATE INDEX IF NOT EXISTS client_profiles_email_idx ON client_profiles(email);
CREATE INDEX IF NOT EXISTS client_profiles_status_idx ON client_profiles(status);
CREATE INDEX IF NOT EXISTS trainer_clients_trainer_idx ON trainer_clients(trainer_id);
CREATE INDEX IF NOT EXISTS trainer_clients_client_idx ON trainer_clients(client_id);
CREATE INDEX IF NOT EXISTS trainer_clients_tenant_idx ON trainer_clients(tenant_host);
CREATE INDEX IF NOT EXISTS trainer_clients_status_idx ON trainer_clients(relationship_status);
-- Triggers for updated_at
CREATE TRIGGER update_client_profiles_updated_at BEFORE
UPDATE ON client_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_trainer_clients_updated_at BEFORE
UPDATE ON trainer_clients FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- Row Level Security
ALTER TABLE client_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE trainer_clients ENABLE ROW LEVEL SECURITY;
-- RLS Policies for client_profiles
-- Clients can view and update their own profile
CREATE POLICY "Clients can view own profile" ON client_profiles FOR
SELECT USING (auth.uid() = id);
CREATE POLICY "Clients can update own profile" ON client_profiles FOR
UPDATE USING (auth.uid() = id);
-- Trainers can view their clients' profiles
CREATE POLICY "Trainers can view their clients" ON client_profiles FOR
SELECT USING (
        EXISTS (
            SELECT 1
            FROM trainer_clients tc
            WHERE tc.client_id = client_profiles.id
                AND tc.trainer_id = auth.uid()
                AND tc.relationship_status = 'active'
        )
    );
-- Trainers can update their clients' profiles (limited fields via application logic)
CREATE POLICY "Trainers can update their clients" ON client_profiles FOR
UPDATE USING (
        EXISTS (
            SELECT 1
            FROM trainer_clients tc
            WHERE tc.client_id = client_profiles.id
                AND tc.trainer_id = auth.uid()
                AND tc.relationship_status = 'active'
        )
    );
-- RLS Policies for trainer_clients
-- Trainers can view their relationships
CREATE POLICY "Trainers can view their client relationships" ON trainer_clients FOR
SELECT USING (trainer_id = auth.uid());
-- Trainers can create client relationships
CREATE POLICY "Trainers can create client relationships" ON trainer_clients FOR
INSERT WITH CHECK (trainer_id = auth.uid());
-- Trainers can update their client relationships
CREATE POLICY "Trainers can update their client relationships" ON trainer_clients FOR
UPDATE USING (trainer_id = auth.uid());
-- Clients can view their relationships
CREATE POLICY "Clients can view their trainer relationships" ON trainer_clients FOR
SELECT USING (client_id = auth.uid());
-- Comments
COMMENT ON TABLE client_profiles IS 'Client user profiles with tenant scoping';
COMMENT ON TABLE trainer_clients IS 'Many-to-many relationship between trainers and clients within tenants';
COMMENT ON COLUMN client_profiles.tenant_host IS 'Associates client with specific tenant (domain)';
COMMENT ON COLUMN trainer_clients.tenant_host IS 'Ensures relationship is scoped to a tenant';