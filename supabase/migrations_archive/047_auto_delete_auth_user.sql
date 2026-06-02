-- Auto-delete auth user when admin_users record is deleted
-- This ensures both records are cleaned up together

-- Function to delete auth user when admin is deleted
CREATE OR REPLACE FUNCTION delete_auth_user_on_admin_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- Delete the corresponding auth.users record
  DELETE FROM auth.users WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on admin_users delete
DROP TRIGGER IF EXISTS trigger_delete_auth_user_on_admin_delete ON admin_users;
CREATE TRIGGER trigger_delete_auth_user_on_admin_delete
  BEFORE DELETE ON admin_users
  FOR EACH ROW
  EXECUTE FUNCTION delete_auth_user_on_admin_delete();
