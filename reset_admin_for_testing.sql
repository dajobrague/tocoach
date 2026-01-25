-- Reset an admin user's password to temporary password for testing first-login flow
-- Replace 'your-admin@email.com' with the actual email you want to test with

-- First, find the user ID (replace with your email)
DO $$
DECLARE
  user_email TEXT := 'your-admin@email.com'; -- CHANGE THIS
  user_id UUID;
BEGIN
  -- Get the user ID
  SELECT id INTO user_id 
  FROM admin_users 
  WHERE email = user_email;

  IF user_id IS NULL THEN
    RAISE EXCEPTION 'Admin user with email % not found', user_email;
  END IF;

  -- Reset password_changed_at to NULL (marks as needing first-login setup)
  UPDATE admin_users
  SET password_changed_at = NULL
  WHERE id = user_id;

  RAISE NOTICE 'Admin user % marked for password reset', user_email;
  RAISE NOTICE 'You will need to manually reset their password in Supabase Dashboard to: TopCoachAdmin2026!';
  RAISE NOTICE 'Go to: Authentication > Users > Find user > Reset Password';
END $$;
