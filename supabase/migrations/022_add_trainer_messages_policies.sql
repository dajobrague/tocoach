-- Add RLS policies for trainers to access messages
-- Trainers should be able to view, insert, and update messages for their clients
-- Policy: Trainers can view messages for their clients
CREATE POLICY messages_trainer_view ON messages FOR
SELECT USING (
        tenant_slug IN (
            SELECT host
            FROM tenants
            WHERE owner_id = current_setting('request.jwt.claims', true)::json->>'sub'
        )
    );
-- Policy: Trainers can insert messages for their clients
CREATE POLICY messages_trainer_insert ON messages FOR
INSERT WITH CHECK (
        tenant_slug IN (
            SELECT host
            FROM tenants
            WHERE owner_id = current_setting('request.jwt.claims', true)::json->>'sub'
        )
        AND sender_type = 'trainer'
    );
-- Policy: Trainers can update messages (mark as read, etc.)
CREATE POLICY messages_trainer_update ON messages FOR
UPDATE USING (
        tenant_slug IN (
            SELECT host
            FROM tenants
            WHERE owner_id = current_setting('request.jwt.claims', true)::json->>'sub'
        )
    ) WITH CHECK (
        tenant_slug IN (
            SELECT host
            FROM tenants
            WHERE owner_id = current_setting('request.jwt.claims', true)::json->>'sub'
        )
    );
-- Comment
COMMENT ON POLICY messages_trainer_view ON messages IS 'Trainers can view all messages for their clients';
COMMENT ON POLICY messages_trainer_insert ON messages IS 'Trainers can send messages to their clients';
COMMENT ON POLICY messages_trainer_update ON messages IS 'Trainers can update message status';