-- Fix RLS for admin_users table
-- Allow anon to read admin_users for API authentication verification
-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Allow admins read own data" ON admin_users;
DROP POLICY IF EXISTS "Allow admins update own data" ON admin_users;
-- Allow anon (API routes) to read admin_users for verification
-- This is safe because:
-- 1. Admin_users doesn't contain sensitive data (no passwords)
-- 2. The API already verifies the JWT before checking admin status
-- 3. This is only for authentication verification, not direct user access
CREATE POLICY "Allow anon read admin_users for verification" ON admin_users FOR
SELECT TO anon USING (true);
-- Allow authenticated admins to read their own data
CREATE POLICY "Allow admins read own data" ON admin_users FOR
SELECT TO authenticated USING (id = auth.uid());
-- Allow authenticated admins to update their own data
CREATE POLICY "Allow admins update own data" ON admin_users FOR
UPDATE TO authenticated USING (id = auth.uid());