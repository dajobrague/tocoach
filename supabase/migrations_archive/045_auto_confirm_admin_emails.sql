-- Auto-confirm email for admin users
-- This trigger automatically confirms emails for users in the admin_users table
-- Note: confirmed_at is a generated column and will update automatically when email_confirmed_at is set
-- Function to auto-confirm admin emails
CREATE OR REPLACE FUNCTION auto_confirm_admin_email() RETURNS TRIGGER AS $$ BEGIN -- If this user is being added to admin_users, confirm their email in auth.users
  -- confirmed_at will be automatically set by Supabase when email_confirmed_at is set
UPDATE auth.users
SET email_confirmed_at = COALESCE(email_confirmed_at, NOW())
WHERE id = NEW.id
  AND email_confirmed_at IS NULL;
RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- Create trigger on admin_users insert
DROP TRIGGER IF EXISTS trigger_auto_confirm_admin_email ON admin_users;
CREATE TRIGGER trigger_auto_confirm_admin_email
AFTER
INSERT ON admin_users FOR EACH ROW EXECUTE FUNCTION auto_confirm_admin_email();
-- Also confirm any existing admin users that aren't confirmed yet
-- confirmed_at will be automatically set by Supabase when email_confirmed_at is set
UPDATE auth.users
SET email_confirmed_at = COALESCE(email_confirmed_at, NOW())
WHERE id IN (
    SELECT id
    FROM admin_users
  )
  AND email_confirmed_at IS NULL;