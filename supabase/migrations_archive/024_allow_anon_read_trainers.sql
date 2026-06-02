-- Allow anon role to read trainers table
-- This is needed because trainers use custom JWT sessions (not Supabase auth)
-- Authentication is handled at the API level via getTrainerSession()
-- Add policy to allow anon to read trainers data
-- API routes validate the session before accessing this data
CREATE POLICY "Allow anon read trainers" ON trainers FOR
SELECT TO anon USING (true);
-- Comment
COMMENT ON POLICY "Allow anon read trainers" ON trainers IS 'Allow anon access - authentication handled at API level via custom JWT sessions';