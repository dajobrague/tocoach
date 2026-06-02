-- Enable Supabase Realtime for notifications and messages tables
-- Add trainer_id column to notifications for trainer-side subscriptions

-- 1. Add trainer_id column to notifications (nullable for existing rows)
ALTER TABLE notifications
ADD COLUMN IF NOT EXISTS trainer_id UUID;

-- 2. Index for trainer-scoped queries and Realtime filters
CREATE INDEX IF NOT EXISTS notifications_trainer_id_idx ON notifications(trainer_id);

-- 3. Backfill trainer_id for existing notifications using tenant_slug -> trainers.tenant_host
UPDATE notifications n
SET trainer_id = t.id
FROM trainers t
WHERE n.tenant_slug = t.tenant_host
  AND n.trainer_id IS NULL;

-- 4. Enable Realtime publication for both tables
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
