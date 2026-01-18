-- Cleanup script for legacy .localhost domains
-- Run this to convert all existing .localhost domains to slug format

-- Update trainers table
UPDATE trainers 
SET tenant_host = REPLACE(tenant_host, '.localhost', '')
WHERE tenant_host LIKE '%.localhost';

-- Update tenants table (host field)
UPDATE tenants 
SET host = REPLACE(host, '.localhost', '')
WHERE host LIKE '%.localhost';

-- Update tenants table (slug field) - extract subdomain part
UPDATE tenants 
SET slug = SPLIT_PART(host, '.', 1)
WHERE slug IS NULL OR slug = '' OR slug LIKE '%.localhost';

-- Verify the changes
SELECT id, tenant_host, email, full_name 
FROM trainers 
WHERE tenant_host NOT LIKE '%.localhost'
LIMIT 10;

SELECT id, slug, host, trainer_id, status
FROM tenants
WHERE slug NOT LIKE '%.localhost'
LIMIT 10;
