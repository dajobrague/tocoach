/**
 * The ONE server-side Supabase factory. Uses the service-role key: the anon
 * and authenticated roles have no grants on public tables (see migration
 * 20260907120000_revoke_anon_table_access.sql), so every server query goes
 * through here. Tenant isolation is the `tenant_host` / `tenant_slug` filter
 * in each service — this client bypasses RLS and does not filter for you.
 *
 * `server-only` turns an accidental import from a "use client" module into a
 * build error instead of a leaked service-role key.
 */
import "server-only";

import { createClient } from "@supabase/supabase-js";

export function createSupabaseAdminClient<Db = any>() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
    );
  }

  return createClient<Db>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    // Pin every PostgREST/storage/rpc call to the service role. Routes such
    // as /api/auth/login call `auth.signInWithPassword()` and then `.from()`
    // on the same instance; supabase-js keeps that GoTrue session in memory
    // (even with persistSession:false) and would otherwise send the user's
    // JWT — role `authenticated`, which has no grants. fetchWithAuth keeps an
    // Authorization header that is already set; gotrue-js still overrides it
    // per request for user-scoped calls like `auth.updateUser()`.
    global: { headers: { Authorization: `Bearer ${serviceRoleKey}` } },
  });
}
