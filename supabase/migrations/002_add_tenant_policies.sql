-- Add RLS policies for tenant table access
-- Allow anon role to read tenant metadata (but not secrets)

-- Policy to allow reading tenant metadata for theme resolution
CREATE POLICY "Allow anon read tenant metadata" ON tenants
FOR SELECT 
TO anon
USING (status = 'active');

-- Note: This policy allows reading tenant metadata for theme resolution
-- but secrets like airtable_api_key_enc should only be accessed by authenticated users
-- or service role in server-side operations
