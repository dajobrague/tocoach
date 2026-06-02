-- Final fix for get_trainer_deletion_impact function
-- Cast the UUID parameter explicitly in all comparisons
CREATE OR REPLACE FUNCTION get_trainer_deletion_impact(trainer_uuid UUID) RETURNS JSON AS $$
DECLARE result JSON;
BEGIN
SELECT json_build_object(
        'clients_count',
        (
            SELECT COUNT(*)
            FROM clients c
                JOIN tenants t ON c.tenant = t.host
            WHERE t.trainer_id::text = trainer_uuid::text
        ),
        'programs_count',
        (
            SELECT COUNT(*)
            FROM programs
            WHERE trainer_id::text = trainer_uuid::text
        ),
        'sessions_count',
        (
            SELECT COUNT(*)
            FROM sessions
            WHERE trainer_id::text = trainer_uuid::text
        ),
        'exercises_count',
        (
            SELECT COUNT(*)
            FROM exercises
            WHERE trainer_id::text = trainer_uuid::text
        ),
        'nutrition_plans_count',
        (
            SELECT COUNT(*)
            FROM nutrition_plans
            WHERE trainer_id::text = trainer_uuid::text
        ),
        'messages_count',
        (
            SELECT COUNT(*)
            FROM messages
            WHERE sender_id::text = trainer_uuid::text
                OR receiver_id::text = trainer_uuid::text
        ),
        'tenants_count',
        (
            SELECT COUNT(*)
            FROM tenants
            WHERE trainer_id::text = trainer_uuid::text
        )
    ) INTO result;
RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;