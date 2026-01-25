-- Add password tracking to admin_users table
-- This helps us detect if an admin is logging in for the first time
ALTER TABLE admin_users
ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMP;
-- Set password_changed_at to NULL for existing admins
-- They will be prompted to change password on next login
UPDATE admin_users
SET password_changed_at = NULL
WHERE password_changed_at IS NULL;