-- Fix the specific trainer's password by resetting it to the standard temp password
-- This needs to be run in Supabase Dashboard SQL Editor with elevated privileges

-- Note: We can't directly update auth.users password via SQL
-- Instead, we need to use Supabase Auth Admin API

-- Option 1: Check if the user exists in auth.users
SELECT 
  id, 
  email, 
  email_confirmed_at,
  created_at,
  last_sign_in_at
FROM auth.users
WHERE email = 'coachjoseca@gmail.com';

-- If the user exists but password doesn't work, we need to:
-- 1. Delete and recreate the user, OR
-- 2. Use the Supabase Dashboard to manually reset the password

-- Let's check if email is confirmed first
