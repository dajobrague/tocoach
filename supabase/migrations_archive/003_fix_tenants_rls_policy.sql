-- Fix RLS policy for tenants table to allow anon inserts during registration

-- Drop existing restrictive policy if it exists
DROP POLICY IF EXISTS "Allow anon read tenant metadata" ON tenants;

-- Create new policy that allows anon to read active and inactive tenants
CREATE POLICY "Allow anon read tenant metadata" ON tenants
FOR SELECT 
TO anon
USING (status IN ('active', 'inactive'));

-- Add policy to allow anon to insert tenants (for trainer registration)
CREATE POLICY "Allow anon insert tenants" ON tenants
FOR INSERT 
TO anon
WITH CHECK (true);

-- Add policy to allow anon to update tenants (for trainer registration upserts)
CREATE POLICY "Allow anon update tenants" ON tenants
FOR UPDATE 
TO anon
USING (true);

-- Fix RLS policy for invitation_codes table to allow anon updates during registration

-- Add policy to allow anon to update invitation codes (mark as used during registration)
CREATE POLICY "Allow anon update invitation codes" ON invitation_codes
FOR UPDATE 
TO anon
USING (status = 'active' AND expires_at > NOW());
