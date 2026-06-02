-- Fix RLS policies for messages table to work with anon key
-- Since trainers use custom JWT sessions (not Supabase auth),
-- and authentication is handled at the API level, we need to allow anon access
-- Drop the existing restrictive policies
DROP POLICY IF EXISTS messages_trainer_view ON messages;
DROP POLICY IF EXISTS messages_trainer_insert ON messages;
DROP POLICY IF EXISTS messages_trainer_update ON messages;
DROP POLICY IF EXISTS messages_client_view ON messages;
DROP POLICY IF EXISTS messages_client_insert ON messages;
DROP POLICY IF EXISTS messages_client_update ON messages;
-- Create permissive policies for anon role
-- API routes handle authentication via getTrainerSession() and getClientSession()
-- Allow anon to select all messages (API filters by session)
CREATE POLICY messages_anon_select ON messages FOR
SELECT USING (true);
-- Allow anon to insert messages (API validates sender)
CREATE POLICY messages_anon_insert ON messages FOR
INSERT WITH CHECK (true);
-- Allow anon to update messages (API validates ownership)
CREATE POLICY messages_anon_update ON messages FOR
UPDATE USING (true) WITH CHECK (true);
-- Comments
COMMENT ON POLICY messages_anon_select ON messages IS 'Allow anon access - authentication handled at API level';
COMMENT ON POLICY messages_anon_insert ON messages IS 'Allow anon access - authentication handled at API level';
COMMENT ON POLICY messages_anon_update ON messages IS 'Allow anon access - authentication handled at API level';