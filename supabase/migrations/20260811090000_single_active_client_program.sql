-- Single-active-program invariant (app-level) — Aug 2026.
--
-- A client keeps many client_programs rows, but at most ONE should be
-- status='active' at a time: the microcycle/day-plan machinery binds to
-- "the" active program, and with several actives the binding was
-- non-deterministic (42 clients had 2+ actives, 12 with tied start_dates).
--
-- This function is the ONLY sanctioned way to activate a program: it
-- activates the target and demotes every other active row of the same
-- client to 'paused' in one atomic statement. Callers:
--   - client "elegir programa" chooser + Activar on paused programs
--   - trainer assign flow (auto-pause previous) and reactivate
--
-- NOTE: a partial unique index (client_id) WHERE status='active' is the
-- eventual hard guarantee, but existing prod data still violates it; the
-- client-side chooser drains those rows. Add the index in a follow-up
-- migration once `SELECT client_id FROM client_programs WHERE status='active'
-- GROUP BY client_id HAVING count(*)>1` returns zero rows.

CREATE OR REPLACE FUNCTION public.activate_client_program(
  p_client_program_id uuid,
  p_client_id bigint
) RETURNS TABLE (demoted_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Ownership check: the target must belong to the caller's client.
  IF NOT EXISTS (
    SELECT 1 FROM client_programs
    WHERE id = p_client_program_id AND client_id = p_client_id
  ) THEN
    RAISE EXCEPTION 'client_program % not found for client %',
      p_client_program_id, p_client_id
      USING ERRCODE = 'P0002';
  END IF;

  RETURN QUERY
  WITH changed AS (
    UPDATE client_programs
    SET status = CASE
          WHEN id = p_client_program_id THEN 'active'
          ELSE 'paused'
        END,
        updated_at = now()
    WHERE client_id = p_client_id
      AND (id = p_client_program_id OR lower(btrim(status)) = 'active')
    RETURNING id
  )
  SELECT id FROM changed WHERE id <> p_client_program_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.activate_client_program(uuid, bigint)
  TO anon, authenticated, service_role;
