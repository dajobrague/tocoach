-- Create notifications table for client notifications
-- Tenant-scoped with RLS policies
-- Create notification type enum
CREATE TYPE notification_type AS ENUM (
    'workout_assigned',
    'message',
    'check_in_reminder',
    'measurement_due',
    'achievement',
    'program_updated',
    'session_scheduled'
);
-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_slug TEXT NOT NULL REFERENCES tenants(host) ON DELETE CASCADE,
    client_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    type notification_type NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    link TEXT,
    -- Optional URL to navigate to on tap
    icon TEXT NOT NULL,
    -- Icon name from iconify
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    -- Constraints
    CONSTRAINT title_not_empty CHECK (title != ''),
    CONSTRAINT message_not_empty CHECK (message != ''),
    CONSTRAINT icon_not_empty CHECK (icon != '')
);
-- Create indexes for performance
CREATE INDEX IF NOT EXISTS notifications_tenant_slug_idx ON notifications(tenant_slug);
CREATE INDEX IF NOT EXISTS notifications_client_id_idx ON notifications(client_id);
CREATE INDEX IF NOT EXISTS notifications_created_at_idx ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_unread_idx ON notifications(client_id, read_at)
WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS notifications_type_idx ON notifications(type);
-- Enable Row Level Security
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
-- RLS Policies for notifications
-- Policy: Clients can view their own notifications
CREATE POLICY notifications_client_view ON notifications FOR
SELECT USING (
        client_id::TEXT = current_setting('request.jwt.claims', true)::json->>'client_id'
    );
-- Policy: Clients can update their own notifications (mark as read)
CREATE POLICY notifications_client_update ON notifications FOR
UPDATE USING (
        client_id::TEXT = current_setting('request.jwt.claims', true)::json->>'client_id'
    ) WITH CHECK (
        client_id::TEXT = current_setting('request.jwt.claims', true)::json->>'client_id'
    );
-- Policy: Clients can delete their own notifications
CREATE POLICY notifications_client_delete ON notifications FOR DELETE USING (
    client_id::TEXT = current_setting('request.jwt.claims', true)::json->>'client_id'
);
-- Comment on table
COMMENT ON TABLE notifications IS 'Stores notifications for clients with tenant isolation';
-- Insert some sample notifications for testing (optional, can be removed)
-- These would normally be created by the trainer dashboard or automated processes