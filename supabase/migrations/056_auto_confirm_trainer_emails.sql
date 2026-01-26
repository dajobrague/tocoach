-- Auto-confirm email for trainer users
-- This trigger automatically confirms emails for users in the trainers table
-- This ensures trainers can log in immediately with their temporary password on first login

-- Function to auto-confirm trainer emails
CREATE OR REPLACE FUNCTION auto_confirm_trainer_email() 
RETURNS TRIGGER AS $$ 
BEGIN 
  -- If this user is being added to trainers, confirm their email in auth.users
  -- confirmed_at will be automatically set by Supabase when email_confirmed_at is set
  UPDATE auth.users
  SET email_confirmed_at = COALESCE(email_confirmed_at, NOW())
  WHERE id = NEW.id
    AND email_confirmed_at IS NULL;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on trainers insert
DROP TRIGGER IF EXISTS trigger_auto_confirm_trainer_email ON trainers;

CREATE TRIGGER trigger_auto_confirm_trainer_email
  AFTER INSERT ON trainers
  FOR EACH ROW
  EXECUTE FUNCTION auto_confirm_trainer_email();

-- Also confirm any existing trainers that aren't confirmed yet
-- This ensures any trainers created before this migration can also log in
UPDATE auth.users
SET email_confirmed_at = COALESCE(email_confirmed_at, NOW())
WHERE id IN (
    SELECT id
    FROM trainers
  )
  AND email_confirmed_at IS NULL;
