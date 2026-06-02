-- Normalize all existing client emails to lowercase and trimmed
-- This fixes case-sensitivity mismatches between stored emails and login lookups
UPDATE clients SET email = LOWER(TRIM(email))
WHERE email IS DISTINCT FROM LOWER(TRIM(email));
