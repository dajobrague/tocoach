-- Add RLS policy for clients table to allow anon role access
-- This matches the pattern established in 017_update_training_rls_policies.sql
-- Security is enforced at the application level through trainer session verification in API routes

-- Ensure RLS is enabled
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if any (for idempotency)
DROP POLICY IF EXISTS "Allow anon to manage clients" ON clients;

-- Allow anon (API routes with verified trainer sessions) to manage clients
CREATE POLICY "Allow anon to manage clients" ON clients FOR ALL TO anon USING (true) WITH CHECK (true);
