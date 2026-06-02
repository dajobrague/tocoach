-- Clean up and fix RLS policies for messages table only
-- Drop all existing message-related policies
DROP POLICY IF EXISTS messages_anon_select ON messages;
DROP POLICY IF EXISTS messages_anon_insert ON messages;
DROP POLICY IF EXISTS messages_anon_update ON messages;
DROP POLICY IF EXISTS messages_trainer_view ON messages;
DROP POLICY IF EXISTS messages_trainer_insert ON messages;
DROP POLICY IF EXISTS messages_trainer_update ON messages;
DROP POLICY IF EXISTS messages_client_view ON messages;
DROP POLICY IF EXISTS messages_client_insert ON messages;
DROP POLICY IF EXISTS messages_client_update ON messages;
-- Create simple permissive policies for anon role
-- Authentication is handled at the API level
-- Allow anon to do everything on messages
-- API routes (getTrainerSession/getClientSession) handle security
CREATE POLICY "messages_allow_anon_all" ON messages FOR ALL TO anon USING (true) WITH CHECK (true);
-- Comment
COMMENT ON POLICY "messages_allow_anon_all" ON messages IS 'Permissive policy - authentication handled at API level via custom JWT sessions';