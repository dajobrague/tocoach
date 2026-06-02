/**
 * Supabase client for integration tests. Uses the service-role (secret) key so
 * tests bypass RLS and can seed/clean rows directly.
 *
 * Server-side / test-only — never import from app code or ship the key to the
 * browser. Reads from `.env.test` (loaded by vitest.integration.config.ts) and
 * refuses to run against anything that is not the local stack, as a guard
 * against accidentally pointing the destructive cleanup helpers at production.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function createSupabaseTestClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (supabaseUrl === undefined || supabaseUrl.length === 0) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL — load .env.test");
  }

  if (serviceRoleKey === undefined || serviceRoleKey.length === 0) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY — load .env.test");
  }

  const isLocal =
    supabaseUrl.includes("127.0.0.1") || supabaseUrl.includes("localhost");

  if (isLocal === false) {
    throw new Error(
      `Refusing to run integration tests against a non-local URL: ${supabaseUrl}`
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
