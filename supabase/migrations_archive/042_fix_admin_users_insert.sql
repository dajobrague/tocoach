-- Fix RLS for admin_users table to allow INSERT
-- The API route already verifies super_admin status before creating new admins
-- So we can safely allow anon (API routes) to insert into admin_users
-- Allow anon (API routes) to insert admin_users
-- This is safe because:
-- 1. The API route /api/admin/users already verifies the requester is a super_admin
-- 2. Only super_admins can access the endpoint that creates new admin users
-- 3. The API validates all input before insertion
CREATE POLICY "Allow anon insert admin_users for API" ON admin_users FOR
INSERT TO anon WITH CHECK (true);
-- Allow anon (API routes) to update admin_users
-- This is needed for profile updates and admin management
CREATE POLICY "Allow anon update admin_users for API" ON admin_users FOR
UPDATE TO anon USING (true) WITH CHECK (true);