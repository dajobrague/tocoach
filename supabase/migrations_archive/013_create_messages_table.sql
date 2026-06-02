-- Create messages table for client-trainer communication
-- Tenant-scoped with RLS policies
-- Create sender type enum
CREATE TYPE message_sender_type AS ENUM ('client', 'trainer');
-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_slug TEXT NOT NULL REFERENCES tenants(host) ON DELETE CASCADE,
    client_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    sender_type message_sender_type NOT NULL,
    sender_id TEXT NOT NULL,
    -- Either client_id or trainer_id as string
    sender_name TEXT NOT NULL,
    message TEXT NOT NULL,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    -- Constraints
    CONSTRAINT message_not_empty CHECK (message != '')
);
-- Create indexes for performance
CREATE INDEX IF NOT EXISTS messages_tenant_slug_idx ON messages(tenant_slug);
CREATE INDEX IF NOT EXISTS messages_client_id_idx ON messages(client_id);
CREATE INDEX IF NOT EXISTS messages_created_at_idx ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS messages_unread_idx ON messages(client_id, read_at)
WHERE read_at IS NULL;
-- Add trigger to maintain updated_at timestamp
CREATE TRIGGER update_messages_updated_at BEFORE
UPDATE ON messages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- Enable Row Level Security
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
-- RLS Policies for messages
-- Policy: Clients can view their own messages
CREATE POLICY messages_client_view ON messages FOR
SELECT USING (
        client_id::TEXT = current_setting('request.jwt.claims', true)::json->>'client_id'
    );
-- Policy: Clients can insert their own messages
CREATE POLICY messages_client_insert ON messages FOR
INSERT WITH CHECK (
        client_id::TEXT = current_setting('request.jwt.claims', true)::json->>'client_id'
        AND sender_type = 'client'
    );
-- Policy: Allow clients to update read_at on their messages
CREATE POLICY messages_client_update ON messages FOR
UPDATE USING (
        client_id::TEXT = current_setting('request.jwt.claims', true)::json->>'client_id'
    ) WITH CHECK (
        client_id::TEXT = current_setting('request.jwt.claims', true)::json->>'client_id'
    );
-- Comment on table
COMMENT ON TABLE messages IS 'Stores chat messages between clients and trainers with tenant isolation';