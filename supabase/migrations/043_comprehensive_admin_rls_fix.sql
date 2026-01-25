-- Comprehensive fix for admin_users RLS policies
-- Drop all existing policies and recreate them properly
-- Drop all existing policies on admin_users
DROP POLICY IF EXISTS "Allow anon read admin_users for verification" ON admin_users;
DROP POLICY IF EXISTS "Allow admins read own data" ON admin_users;
DROP POLICY IF EXISTS "Allow admins update own data" ON admin_users;
DROP POLICY IF EXISTS "Allow anon insert admin_users for API" ON admin_users;
DROP POLICY IF EXISTS "Allow anon update admin_users for API" ON admin_users;
-- Ensure RLS is enabled
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
-- Policy 1: Allow anon (API routes) to read admin_users for authentication verification
-- This is safe because the API already verifies JWT before checking admin status
CREATE POLICY "admin_users_anon_select" ON admin_users FOR
SELECT TO anon USING (true);
-- Policy 2: Allow anon (API routes) to insert new admin users
-- This is safe because the API route verifies super_admin status before allowing creation
CREATE POLICY "admin_users_anon_insert" ON admin_users FOR
INSERT TO anon WITH CHECK (true);
-- Policy 3: Allow anon (API routes) to update admin users
-- This is safe because the API route verifies permissions before allowing updates
CREATE POLICY "admin_users_anon_update" ON admin_users FOR
UPDATE TO anon USING (true) WITH CHECK (true);
-- Policy 4: Allow authenticated admins to read their own data
CREATE POLICY "admin_users_authenticated_select" ON admin_users FOR
SELECT TO authenticated USING (id = auth.uid());
-- Policy 5: Allow authenticated admins to update their own data
CREATE POLICY "admin_users_authenticated_update" ON admin_users FOR
UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());