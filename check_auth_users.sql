-- Check auth users and their confirmation status
SELECT 
    id,
    email,
    email_confirmed_at,
    created_at,
    confirmed_at,
    last_sign_in_at
FROM auth.users
WHERE email IN (
    SELECT email FROM admin_users
)
ORDER BY created_at DESC;
