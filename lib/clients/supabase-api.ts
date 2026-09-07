/**
 * Supabase client factory for API routes
 * Creates client lazily to avoid build-time initialization
 */
import { createSupabaseAdminClient } from "./supabase-admin";

/**
 * Create a Supabase client for API routes (service role, see supabase-admin.ts)
 * This should be called inside route handlers, not at module level
 *
 * Note: Trainers use custom JWT sessions (not Supabase auth sessions)
 * Authentication is verified at the API route level via getTrainerSession()
 * Tenant scoping is the `tenant_host` filter in each query — not RLS.
 */
export function createSupabaseClient() {
  return createSupabaseAdminClient();
}
