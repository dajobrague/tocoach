-- Check constraints on admin_users table
SELECT 
    con.conname AS constraint_name,
    con.contype AS constraint_type,
    CASE con.contype
        WHEN 'c' THEN 'CHECK'
        WHEN 'f' THEN 'FOREIGN KEY'
        WHEN 'p' THEN 'PRIMARY KEY'
        WHEN 'u' THEN 'UNIQUE'
        WHEN 't' THEN 'TRIGGER'
        ELSE con.contype::text
    END AS constraint_description,
    pg_get_constraintdef(con.oid) AS constraint_definition
FROM pg_constraint con
INNER JOIN pg_class rel ON rel.oid = con.conrelid
INNER JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
WHERE rel.relname = 'admin_users'
    AND nsp.nspname = 'public'
ORDER BY con.contype, con.conname;

-- Check triggers on admin_users table
SELECT 
    tgname AS trigger_name,
    tgenabled AS is_enabled,
    tgtype AS trigger_type,
    pg_get_triggerdef(oid) AS trigger_definition
FROM pg_trigger
WHERE tgrelid = 'public.admin_users'::regclass
AND tgisinternal = false;
