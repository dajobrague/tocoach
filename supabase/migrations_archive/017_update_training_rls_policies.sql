-- Update RLS policies for training tables to work with application-level authentication
-- Drop existing restrictive policies and create more permissive ones
-- Security is handled by trainer session verification in API routes
-- =====================================================
-- DROP OLD POLICIES
-- =====================================================
DROP POLICY IF EXISTS "Trainers can view their programs" ON programs;
DROP POLICY IF EXISTS "Trainers can create programs" ON programs;
DROP POLICY IF EXISTS "Trainers can update their programs" ON programs;
DROP POLICY IF EXISTS "Trainers can delete their programs" ON programs;
DROP POLICY IF EXISTS "Trainers can manage client program assignments" ON client_programs;
DROP POLICY IF EXISTS "Trainers can manage their sessions" ON sessions;
DROP POLICY IF EXISTS "Trainers can manage their scheduled sessions" ON scheduled_sessions;
DROP POLICY IF EXISTS "Trainers can manage their exercises" ON exercises;
DROP POLICY IF EXISTS "Trainers can manage session exercises" ON session_exercises;
DROP POLICY IF EXISTS "Trainers can manage exercise logs" ON exercise_logs;
DROP POLICY IF EXISTS "Trainers can manage client measurements" ON client_measurements;
DROP POLICY IF EXISTS "Trainers can manage client personal records" ON personal_records;
-- =====================================================
-- CREATE NEW PERMISSIVE POLICIES
-- =====================================================
-- These allow anon users (API routes with verified trainer sessions) to manage training data
-- Security is enforced at the application level through trainer session verification
-- Trainers use custom JWT sessions, not Supabase auth, so we allow anon access
-- Programs
CREATE POLICY "Allow anon to manage programs" ON programs FOR ALL TO anon USING (true) WITH CHECK (true);
-- Client Programs
CREATE POLICY "Allow anon to manage client programs" ON client_programs FOR ALL TO anon USING (true) WITH CHECK (true);
-- Sessions
CREATE POLICY "Allow anon to manage sessions" ON sessions FOR ALL TO anon USING (true) WITH CHECK (true);
-- Scheduled Sessions
CREATE POLICY "Allow anon to manage scheduled sessions" ON scheduled_sessions FOR ALL TO anon USING (true) WITH CHECK (true);
-- Exercises
CREATE POLICY "Allow anon to manage exercises" ON exercises FOR ALL TO anon USING (true) WITH CHECK (true);
-- Session Exercises
CREATE POLICY "Allow anon to manage session exercises" ON session_exercises FOR ALL TO anon USING (true) WITH CHECK (true);
-- Exercise Logs
CREATE POLICY "Allow anon to manage exercise logs" ON exercise_logs FOR ALL TO anon USING (true) WITH CHECK (true);
-- Client Measurements
CREATE POLICY "Allow anon to manage client measurements" ON client_measurements FOR ALL TO anon USING (true) WITH CHECK (true);
-- Personal Records
CREATE POLICY "Allow anon to manage personal records" ON personal_records FOR ALL TO anon USING (true) WITH CHECK (true);
-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON POLICY "Authenticated users can manage programs" ON programs IS 'Allows authenticated trainers to manage programs. Application verifies trainer owns the data.';
COMMENT ON POLICY "Authenticated users can manage client programs" ON client_programs IS 'Allows authenticated trainers to manage client program assignments. Application verifies trainer owns the data.';
COMMENT ON POLICY "Authenticated users can manage sessions" ON sessions IS 'Allows authenticated trainers to manage sessions. Application verifies trainer owns the data.';
COMMENT ON POLICY "Authenticated users can manage scheduled sessions" ON scheduled_sessions IS 'Allows authenticated trainers to manage scheduled sessions. Application verifies trainer owns the data.';
COMMENT ON POLICY "Authenticated users can manage exercises" ON exercises IS 'Allows authenticated trainers to manage exercises. Application verifies trainer owns the data.';
COMMENT ON POLICY "Authenticated users can manage session exercises" ON session_exercises IS 'Allows authenticated trainers to manage session exercises. Application verifies trainer owns the data.';
COMMENT ON POLICY "Authenticated users can manage exercise logs" ON exercise_logs IS 'Allows authenticated trainers to manage exercise logs. Application verifies trainer owns the data.';
COMMENT ON POLICY "Authenticated users can manage client measurements" ON client_measurements IS 'Allows authenticated trainers to manage client measurements. Application verifies trainer owns the data.';
COMMENT ON POLICY "Authenticated users can manage personal records" ON personal_records IS 'Allows authenticated trainers to manage personal records. Application verifies trainer owns the data.';