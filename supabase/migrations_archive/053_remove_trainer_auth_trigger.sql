-- Remove the trigger that deletes auth.users when trainer is deleted
-- This is not needed because trainers.id REFERENCES auth.users(id) ON DELETE CASCADE
-- The foreign key relationship already handles the cascade delete properly
-- Drop the trigger
DROP TRIGGER IF EXISTS trigger_delete_auth_user_on_trainer_delete ON trainers;
-- Drop the function
DROP FUNCTION IF EXISTS delete_auth_user_on_trainer_delete();
-- Note: The trainers table has a foreign key: trainers.id -> auth.users(id) ON DELETE CASCADE
-- This means:
-- - When auth.users is deleted, trainer is automatically deleted (correct)
-- - When trainer is deleted, we DON'T want to delete auth.users
-- - If we want to delete both, we should delete auth.users first, which will cascade to trainer