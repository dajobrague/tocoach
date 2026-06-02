-- Add RLS policy to allow anon role to insert trainers
-- This is needed for admin API to create new trainers
-- Enable RLS on trainers if not already enabled
ALTER TABLE trainers ENABLE ROW LEVEL SECURITY;
-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "trainers_anon_insert" ON trainers;
-- Allow anon role to insert trainers (used by admin API)
CREATE POLICY "trainers_anon_insert" ON trainers FOR
INSERT TO anon WITH CHECK (true);
-- Also add SELECT policy for anon if it doesn't exist
DROP POLICY IF EXISTS "trainers_anon_select" ON trainers;
CREATE POLICY "trainers_anon_select" ON trainers FOR
SELECT TO anon USING (true);
-- Comment for documentation
COMMENT ON POLICY "trainers_anon_insert" ON trainers IS 'Allow admin API to create new trainers using anon key';
COMMENT ON POLICY "trainers_anon_select" ON trainers IS 'Allow admin API to read trainers using anon key';