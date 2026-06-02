-- Fix duplicate tenant records issue
-- Problem: Some trainers have multiple tenant records, causing .maybeSingle() to fail
-- Solution: Add unique constraint on trainer_id to prevent future duplicates

-- Add unique constraint on trainer_id to prevent future duplicates
-- Note: NULL values are allowed (for demo tenants without trainers)
CREATE UNIQUE INDEX IF NOT EXISTS tenants_trainer_id_unique_idx 
ON tenants(trainer_id) 
WHERE trainer_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON INDEX tenants_trainer_id_unique_idx IS 'Ensures each trainer can only have one tenant record';

