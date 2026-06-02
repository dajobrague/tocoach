-- Fix the get_trainer_deletion_impact function
-- The clients table uses 'tenant' column, not 'trainer_id'
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