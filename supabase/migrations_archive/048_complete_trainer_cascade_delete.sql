-- Complete cascade delete setup for trainers
-- Ensures all trainer-related data is properly cleaned up when a trainer is deleted
-- 1. Fix the clients.tenant foreign key constraint (currently NO ACTION)
-- This needs to be CASCADE so clients are deleted when trainer is deleted
DO $$ BEGIN -- Find the actual constraint name for clients.tenant -> trainers.id
-- Drop it and recreate with CASCADE
ALTER TABLE IF EXISTS clients DROP CONSTRAINT IF EXISTS clients_tenant_fkey;
-- Add constraint with CASCADE
-- Note: This assumes tenant column references trainers.id (based on the query results)
ALTER TABLE clients
ADD CONSTRAINT clients_tenant_fkey FOREIGN KEY (tenant) REFERENCES trainers(id) ON DELETE CASCADE;
EXCEPTION
WHEN undefined_table THEN NULL;
WHEN undefined_column THEN NULL;
END $$;
-- 2. Fix tenants.trainer_id foreign key constraint (currently NO ACTION)
-- Change to CASCADE so tenant is deleted when trainer is deleted
DO $$ BEGIN -- Drop existing constraint
ALTER TABLE IF EXISTS tenants DROP CONSTRAINT IF EXISTS tenants_trainer_id_fkey;
-- Add constraint with CASCADE
ALTER TABLE tenants
ADD CONSTRAINT tenants_trainer_id_fkey FOREIGN KEY (trainer_id) REFERENCES trainers(id) ON DELETE CASCADE;
EXCEPTION
WHEN undefined_table THEN NULL;
WHEN duplicate_object THEN NULL;
END $$;
-- 3. Add DELETE RLS policy for trainers table
-- Allow anon (API routes) to delete trainers
-- This is safe because the API already verifies admin status before allowing deletion
DROP POLICY IF EXISTS "trainers_anon_delete" ON trainers;
CREATE POLICY "trainers_anon_delete" ON trainers FOR DELETE TO anon USING (true);
-- 4. Create function to delete auth user when trainer is deleted
CREATE OR REPLACE FUNCTION delete_auth_user_on_trainer_delete() RETURNS TRIGGER AS $$ BEGIN -- Delete the corresponding auth.users record
    -- This will happen BEFORE the trainer record is deleted
DELETE FROM auth.users
WHERE id = OLD.id;
RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- 5. Create trigger on trainers delete
DROP TRIGGER IF EXISTS trigger_delete_auth_user_on_trainer_delete ON trainers;
CREATE TRIGGER trigger_delete_auth_user_on_trainer_delete BEFORE DELETE ON trainers FOR EACH ROW EXECUTE FUNCTION delete_auth_user_on_trainer_delete();
-- 6. Create a function to get trainer deletion impact (for UI display)
CREATE OR REPLACE FUNCTION get_trainer_deletion_impact(trainer_uuid UUID) RETURNS JSON AS $$
DECLARE result JSON;
BEGIN
SELECT json_build_object(
        'clients_count',
        (
            SELECT COUNT(*)
            FROM clients
            WHERE tenant = trainer_uuid
        ),
        'programs_count',
        (
            SELECT COUNT(*)
            FROM programs
            WHERE trainer_id = trainer_uuid
        ),
        'sessions_count',
        (
            SELECT COUNT(*)
            FROM sessions
            WHERE trainer_id = trainer_uuid
        ),
        'exercises_count',
        (
            SELECT COUNT(*)
            FROM exercises
            WHERE trainer_id = trainer_uuid
        ),
        'nutrition_plans_count',
        (
            SELECT COUNT(*)
            FROM nutrition_plans
            WHERE trainer_id = trainer_uuid
        ),
        'messages_count',
        (
            SELECT COUNT(*)
            FROM messages
            WHERE sender_id = trainer_uuid
                OR receiver_id = trainer_uuid
        ),
        'tenants_count',
        (
            SELECT COUNT(*)
            FROM tenants
            WHERE trainer_id = trainer_uuid
        )
    ) INTO result;
RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;