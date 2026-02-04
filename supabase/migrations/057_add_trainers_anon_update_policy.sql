-- Add UPDATE policy for anon role on trainers table
-- This is needed for the setup-password API route to update password_set_at
-- Without this policy, trainers cannot complete their first login flow

-- Drop if exists to avoid conflicts
DROP POLICY IF EXISTS "trainers_anon_update" ON trainers;

-- Allow anon role to update trainers (used by API routes)
-- This is safe because the API route verifies permissions before allowing updates
CREATE POLICY "trainers_anon_update" ON trainers 
FOR UPDATE TO anon 
USING (true) 
WITH CHECK (true);

-- Add comment for documentation
COMMENT ON POLICY "trainers_anon_update" ON trainers 
IS 'Allow API routes to update trainer records using anon key - required for setup-password and other trainer management APIs';
