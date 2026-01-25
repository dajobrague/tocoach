-- Migration: Create Admin System
-- Description: Add admin users table and subscription management for trainers
-- 1. Create admin_users table
CREATE TABLE admin_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT DEFAULT 'super_admin' CHECK (role IN ('super_admin', 'admin')),
  created_at TIMESTAMP DEFAULT NOW(),
  last_login_at TIMESTAMP,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive'))
);
-- Create indexes for admin_users
CREATE INDEX admin_users_email_idx ON admin_users(email);
CREATE INDEX admin_users_status_idx ON admin_users(status);
CREATE INDEX admin_users_role_idx ON admin_users(role);
-- 2. Add subscription and invitation fields to trainers table
ALTER TABLE trainers
ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'active' CHECK (
    subscription_status IN ('active', 'paused', 'cancelled')
  );
ALTER TABLE trainers
ADD COLUMN IF NOT EXISTS password_set_at TIMESTAMP;
ALTER TABLE trainers
ADD COLUMN IF NOT EXISTS invited_by UUID REFERENCES admin_users(id);
ALTER TABLE trainers
ADD COLUMN IF NOT EXISTS invited_at TIMESTAMP DEFAULT NOW();
-- Create indexes for new trainer columns
CREATE INDEX trainers_subscription_status_idx ON trainers(subscription_status);
CREATE INDEX trainers_invited_by_idx ON trainers(invited_by);
CREATE INDEX trainers_password_set_at_idx ON trainers(password_set_at);
-- 3. Enable Row Level Security for admin_users
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
-- 4. Create RLS policies for admin_users
-- Allow admins to read their own data
CREATE POLICY "Allow admins read own data" ON admin_users FOR
SELECT TO authenticated USING (id = auth.uid());
-- Allow admins to update their own data
CREATE POLICY "Allow admins update own data" ON admin_users FOR
UPDATE TO authenticated USING (id = auth.uid());
-- 5. Create RLS policies for trainers - admin access
-- Allow admins to read all trainers
CREATE POLICY "Allow admins read all trainers" ON trainers FOR
SELECT TO authenticated USING (
    EXISTS (
      SELECT 1
      FROM admin_users
      WHERE id = auth.uid()
        AND status = 'active'
    )
  );
-- Allow admins to create trainers
CREATE POLICY "Allow admins create trainers" ON trainers FOR
INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1
      FROM admin_users
      WHERE id = auth.uid()
        AND status = 'active'
    )
  );
-- Allow admins to update trainers
CREATE POLICY "Allow admins update trainers" ON trainers FOR
UPDATE TO authenticated USING (
    EXISTS (
      SELECT 1
      FROM admin_users
      WHERE id = auth.uid()
        AND status = 'active'
    )
  );
-- 6. Add comments for documentation
COMMENT ON TABLE admin_users IS 'Super admin users who manage trainer accounts and subscriptions';
COMMENT ON COLUMN admin_users.role IS 'Admin role: super_admin (full access) or admin (limited access)';
COMMENT ON COLUMN trainers.subscription_status IS 'Trainer subscription status: active, paused, or cancelled';
COMMENT ON COLUMN trainers.password_set_at IS 'Timestamp when trainer first set their password (NULL = needs setup)';
COMMENT ON COLUMN trainers.invited_by IS 'Which admin created this trainer account';
COMMENT ON COLUMN trainers.invited_at IS 'When the trainer invitation was created';
-- Note: To create the first admin user:
-- 1. Create user in Supabase Auth Dashboard (Authentication > Users > Add user)
-- 2. Insert admin record with SQL:
--    INSERT INTO admin_users (id, email, full_name, role) 
--    VALUES ('user-uuid-from-auth', 'admin@example.com', 'Admin Name', 'super_admin');