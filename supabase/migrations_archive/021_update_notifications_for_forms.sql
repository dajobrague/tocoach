-- Update notifications table to support form notifications
-- Add new notification types to the enum
ALTER TYPE notification_type
ADD VALUE IF NOT EXISTS 'form_weekly_available';
ALTER TYPE notification_type
ADD VALUE IF NOT EXISTS 'form_weekly_reminder';
ALTER TYPE notification_type
ADD VALUE IF NOT EXISTS 'form_weekly_expiring';
ALTER TYPE notification_type
ADD VALUE IF NOT EXISTS 'form_weekly_expired';
ALTER TYPE notification_type
ADD VALUE IF NOT EXISTS 'form_daily_available';
ALTER TYPE notification_type
ADD VALUE IF NOT EXISTS 'form_daily_reminder';
-- Add metadata column for storing additional notification data (like form_type, action)
ALTER TABLE notifications
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
-- Create GIN index for metadata queries
CREATE INDEX IF NOT EXISTS notifications_metadata_gin_idx ON notifications USING GIN (metadata);
-- Make icon column optional (we can derive it from type)
ALTER TABLE notifications
ALTER COLUMN icon DROP NOT NULL;
-- Update RLS policies to be more permissive (since we use custom auth)
DROP POLICY IF EXISTS notifications_client_view ON notifications;
DROP POLICY IF EXISTS notifications_client_update ON notifications;
DROP POLICY IF EXISTS notifications_client_delete ON notifications;
-- Allow anon access (security handled at API level)
CREATE POLICY notifications_anon_access ON notifications FOR ALL USING (true) WITH CHECK (true);