-- Migration: Create trainer authentication tables
-- Description: Set up invitation codes and trainers tables for authentication

-- 1. Create invitation codes table (general, not brand-specific)
CREATE TABLE invitation_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  created_by TEXT DEFAULT 'system', -- Who created this code (admin, system, etc.)
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  used_by_trainer_id UUID REFERENCES auth.users(id),
  max_uses INTEGER DEFAULT 1, -- Allow multiple uses if needed
  current_uses INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'used', 'expired', 'revoked'))
);

-- Create indexes for fast lookups
CREATE INDEX invitation_codes_code_idx ON invitation_codes(code);
CREATE INDEX invitation_codes_status_idx ON invitation_codes(status);
CREATE INDEX invitation_codes_expires_idx ON invitation_codes(expires_at);

-- 2. Create trainers table (trainer = tenant owner)
CREATE TABLE trainers (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_host TEXT UNIQUE NOT NULL, -- They choose this during registration
  email TEXT NOT NULL,
  full_name TEXT,
  invitation_code_used TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_login_at TIMESTAMP,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive'))
);

-- Create indexes for trainers
CREATE INDEX trainers_tenant_host_idx ON trainers(tenant_host);
CREATE INDEX trainers_email_idx ON trainers(email);
CREATE INDEX trainers_status_idx ON trainers(status);

-- 3. Add trainer_id column to existing tenants table
ALTER TABLE tenants ADD COLUMN trainer_id UUID REFERENCES trainers(id);
CREATE INDEX tenants_trainer_id_idx ON tenants(trainer_id);

-- 4. Enable Row Level Security
ALTER TABLE invitation_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE trainers ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS policies for invitation_codes
-- Allow anon to read active invitation codes (for validation during registration)
CREATE POLICY "Allow anon read active invitations" ON invitation_codes
FOR SELECT TO anon
USING (status = 'active' AND expires_at > NOW());

-- Allow anon to update invitation codes (mark as used during registration)
CREATE POLICY "Allow anon update invitation usage" ON invitation_codes
FOR UPDATE TO anon
USING (status = 'active' AND expires_at > NOW());

-- 6. Create RLS policies for trainers
-- Allow anon to insert trainers (for registration)
CREATE POLICY "Allow anon insert trainers" ON trainers
FOR INSERT TO anon
WITH CHECK (true);

-- Allow trainers to read their own data
CREATE POLICY "Allow trainers read own data" ON trainers
FOR SELECT TO authenticated
USING (id = auth.uid());

-- Allow trainers to update their own data
CREATE POLICY "Allow trainers update own data" ON trainers
FOR UPDATE TO authenticated
USING (id = auth.uid());

-- 7. Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for trainers table
CREATE TRIGGER update_trainers_updated_at 
    BEFORE UPDATE ON trainers 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- 8. Insert sample invitation codes for testing
INSERT INTO invitation_codes (code, expires_at, created_by) VALUES
('COACH-ALPHA-2024', NOW() + INTERVAL '30 days', 'system'),
('TRAINER-BETA-2024', NOW() + INTERVAL '30 days', 'system'),
('TOPCOACH-EARLY-2024', NOW() + INTERVAL '90 days', 'system');

-- 9. Add comments for documentation
COMMENT ON TABLE invitation_codes IS 'General invitation codes for trainer registration (not brand-specific)';
COMMENT ON TABLE trainers IS 'Trainer accounts - each trainer owns one tenant';
COMMENT ON COLUMN trainers.tenant_host IS 'The domain/host this trainer owns (e.g., ironfit.localhost)';
COMMENT ON COLUMN invitation_codes.code IS 'Unique invitation code for trainer registration';
COMMENT ON COLUMN invitation_codes.max_uses IS 'Maximum number of times this code can be used';
COMMENT ON COLUMN invitation_codes.current_uses IS 'Current number of times this code has been used';
