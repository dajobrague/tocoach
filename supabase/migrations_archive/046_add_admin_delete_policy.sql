-- Add DELETE policy for admin_users table
-- This allows the API (using anon role) to delete admin users
-- The API already verifies super_admin status before allowing deletion
-- Policy: Allow anon (API routes) to delete admin users
-- This is safe because the API route verifies super_admin status before allowing deletion
CREATE POLICY "admin_users_anon_delete" ON admin_users FOR DELETE TO anon USING (true);