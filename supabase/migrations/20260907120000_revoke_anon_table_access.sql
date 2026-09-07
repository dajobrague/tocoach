-- =============================================================================
-- RLS hardening (Opción A): anon / authenticated lose all table access
-- =============================================================================
-- Context: docs/architecture/rls-hardening-impact-2026-09-07.md
--
-- Before this migration every table in `public` was readable AND writable with
-- the anon key that ships in the browser bundle (permissive `USING (true)`
-- policies for anon on 58 tables, RLS disabled on 5). The app never relied on
-- that: every server query filters by tenant_host / tenant_slug itself.
--
-- DEPLOY ORDER — do not reorder:
--   1. Deploy the app code that reaches Postgres with SUPABASE_SERVICE_ROLE_KEY
--      (lib/clients/supabase-admin.ts is the single factory; middleware.ts has
--      its own inline client) together with the Realtime token endpoint
--      (GET /api/realtime/token, needs SUPABASE_JWT_SECRET in the server env).
--      Verify login, chat and the notification bell.
--   2. Only then apply this migration. Applying it first leaves a window where
--      every server query (still on the anon key) fails with permission denied.
--
-- Rollback (restores the previous, open state):
--   grant all on all tables in schema public to anon, authenticated;
--   grant all on all sequences in schema public to anon, authenticated;
--   (policies dropped below were `USING (true)` for anon — recreate if needed)
-- =============================================================================

-- 1. Blanket revoke ------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

-- Tables/sequences/functions created by future migrations (run as this role)
-- no longer receive automatic grants. Objects created from the Dashboard are
-- owned by supabase_admin, whose default ACL cannot be altered from here —
-- review those by hand.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;

-- 2. SECURITY DEFINER functions ---------------------------------------------
-- These run as their owner (postgres) and were callable through
-- /rest/v1/rpc/<name> with the anon key. Their ACL grants EXECUTE to PUBLIC
-- (`=X/postgres`) as well as to anon/authenticated explicitly, so revoking
-- from anon/authenticated alone would be a no-op: PUBLIC must go too.
-- postgres and service_role keep their explicit grants (app code calls
-- get_trainer_deletion_impact / cleanup_expired_otps with the service role);
-- the trigger functions fire under the DML role, which is service_role.
revoke execute on function public.auto_confirm_admin_email() from public, anon, authenticated;
revoke execute on function public.auto_confirm_trainer_email() from public, anon, authenticated;
revoke execute on function public.cleanup_expired_otps() from public, anon, authenticated;
revoke execute on function public.delete_auth_user_on_admin_delete() from public, anon, authenticated;
revoke execute on function public.get_client_checkin_streak(bigint) from public, anon, authenticated;
revoke execute on function public.get_tenant_host_for_client(bigint) from public, anon, authenticated;
revoke execute on function public.get_trainer_deletion_impact(uuid) from public, anon, authenticated;

-- 3. Realtime: the one browser consumer that needs table access ----------------
-- Browser hooks subscribe to postgres_changes on messages / notifications with
-- a JWT minted by GET /api/realtime/token (role: authenticated, claims: kind,
-- user_id, tenant_host, tenant_slug). Realtime evaluates these SELECT policies
-- with those claims for every change it fans out.
drop policy if exists messages_allow_anon_all on public.messages;
drop policy if exists notifications_anon_access on public.notifications;

grant select on public.messages, public.notifications to authenticated;

-- messages.tenant_slug stores the tenant HOST (both writers in
-- app/api/messages/*). Trainers listen tenant-wide; clients only to their own
-- conversation.
create policy messages_realtime_select on public.messages
  for select to authenticated
  using (
    tenant_slug = (auth.jwt() ->> 'tenant_host')
    and (
      (auth.jwt() ->> 'kind') = 'trainer'
      or client_id::text = (auth.jwt() ->> 'user_id')
    )
  );

-- notifications.tenant_slug is NOT consistent: chat/video rows store the SLUG
-- (lib/notifications/chat-notification.ts) but form reminders store the HOST
-- (app/api/forms/notifications/create). Accept either so no writer's rows
-- silently stop reaching the bell. The recipient id is what isolates
-- tenants: trainer_id (auth uuid) and client_id (global serial) are unique
-- across tenants.
create policy notifications_realtime_select on public.notifications
  for select to authenticated
  using (
    tenant_slug in (auth.jwt() ->> 'tenant_slug', auth.jwt() ->> 'tenant_host')
    and (
      ((auth.jwt() ->> 'kind') = 'trainer' and trainer_id::text = (auth.jwt() ->> 'user_id'))
      or ((auth.jwt() ->> 'kind') = 'client' and client_id::text = (auth.jwt() ->> 'user_id'))
    )
  );

-- 4. Tables that never had RLS on --------------------------------------------
-- No grants remain for anon/authenticated, so this is belt-and-braces; it also
-- makes a future accidental GRANT harmless instead of a full leak.
alter table public.client_checkins enable row level security;
alter table public.client_goals enable row level security;
alter table public.client_step_tracking enable row level security;
alter table public.client_water_intake enable row level security;
alter table public.tenant_events enable row level security;
