-- Migration: Make invitation code optional for trainer registration
-- Description: Update trainers table to allow NULL invitation codes since we're removing the requirement
-- Make invitation_code_used nullable (it should already be, but this ensures it)
ALTER TABLE trainers
ALTER COLUMN invitation_code_used DROP NOT NULL;
-- Add comment to explain this field is now optional
COMMENT ON COLUMN trainers.invitation_code_used IS 'Optional invitation code that was used during registration (deprecated field, kept for historical data)';