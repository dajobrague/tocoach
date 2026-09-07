/**
 * Typed server-side Supabase client for API routes and server components.
 * Thin wrapper over the single service-role factory in `supabase-admin.ts`;
 * kept for its `Database`-typed return and the module singleton below.
 */

import type { Database } from "@/types/supabase";

import { createSupabaseAdminClient } from "./supabase-admin";

export function createServerSupabaseClient() {
  return createSupabaseAdminClient<Database>();
}

// Re-export for convenience
export const supabase = createServerSupabaseClient();
