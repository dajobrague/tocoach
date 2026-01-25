-- Check current admin users and their status
SELECT 
    au.id,
    au.email,
    au.full_name,
    au.role,
    au.status,
    au.password_changed_at,
    au.created_at,
    u.email_confirmed_at,
    u.created_at as auth_created_at
FROM admin_users au
LEFT JOIN auth.users u ON au.id = u.id
ORDER BY au.created_at DESC;
