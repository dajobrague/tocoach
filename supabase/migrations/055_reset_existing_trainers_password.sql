-- Mark existing trainers as having their password already set
-- This prevents them from being forced into the password setup flow
-- Only trainers created by the new admin flow (after this migration) will have NULL
-- Set password_set_at to created_at for existing trainers who don't have it set
-- This assumes they already have a working password
UPDATE trainers
SET password_set_at = COALESCE(created_at, NOW())
WHERE password_set_at IS NULL;
-- Comment for documentation
COMMENT ON COLUMN trainers.password_set_at IS 'Timestamp when trainer first set their password. NULL = needs to complete password setup on next login (new trainers only).';