-- Debug version - test each query separately to find the issue
-- This will help identify which table has the type mismatch
CREATE OR REPLACE FUNCTION get_trainer_deletion_impact(trainer_uuid UUID) RETURNS JSON AS $$
DECLARE result JSON;
v_clients_count INT := 0;
v_programs_count INT := 0;
v_sessions_count INT := 0;
v_exercises_count INT := 0;
v_nutrition_count INT := 0;
v_messages_count INT := 0;
v_tenants_count INT := 0;
BEGIN -- Test each count separately to isolate the error
BEGIN
SELECT COUNT(*) INTO v_tenants_count
FROM tenants
WHERE trainer_id = trainer_uuid;
EXCEPTION
WHEN OTHERS THEN v_tenants_count := -1;
-- Error indicator
END;
BEGIN
SELECT COUNT(*) INTO v_clients_count
FROM clients c
    JOIN tenants t ON c.tenant = t.host
WHERE t.trainer_id = trainer_uuid;
EXCEPTION
WHEN OTHERS THEN v_clients_count := -1;
END;
BEGIN
SELECT COUNT(*) INTO v_programs_count
FROM programs
WHERE trainer_id = trainer_uuid;
EXCEPTION
WHEN OTHERS THEN v_programs_count := -1;
END;
BEGIN
SELECT COUNT(*) INTO v_sessions_count
FROM sessions
WHERE trainer_id = trainer_uuid;
EXCEPTION
WHEN OTHERS THEN v_sessions_count := -1;
END;
BEGIN
SELECT COUNT(*) INTO v_exercises_count
FROM exercises
WHERE trainer_id = trainer_uuid;
EXCEPTION
WHEN OTHERS THEN v_exercises_count := -1;
END;
BEGIN
SELECT COUNT(*) INTO v_nutrition_count
FROM nutrition_plans
WHERE trainer_id = trainer_uuid;
EXCEPTION
WHEN OTHERS THEN v_nutrition_count := -1;
END;
BEGIN
SELECT COUNT(*) INTO v_messages_count
FROM messages
WHERE sender_id = trainer_uuid
    OR receiver_id = trainer_uuid;
EXCEPTION
WHEN OTHERS THEN v_messages_count := -1;
END;
SELECT json_build_object(
        'clients_count',
        v_clients_count,
        'programs_count',
        v_programs_count,
        'sessions_count',
        v_sessions_count,
        'exercises_count',
        v_exercises_count,
        'nutrition_plans_count',
        v_nutrition_count,
        'messages_count',
        v_messages_count,
        'tenants_count',
        v_tenants_count
    ) INTO result;
RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;