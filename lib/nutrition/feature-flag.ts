import type { SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseClient } from "@/lib/clients/supabase-api";

/**
 * Per-trainer nutrition-v2 feature flag (default OFF in production).
 *
 * Outside production (dev and test), it is always enabled — local work never
 * needs the per-tenant flag flipped. In production it reads
 * `tenants.nutrition_v2_enabled` for the given host and returns `false` for any
 * failure mode — missing tenant, missing row, missing column, or query error —
 * so callers can treat it as a safe, fail-closed gate. Usable from both trainer
 * and client server contexts (pass a client, or it builds the default anon API
 * client).
 */
export async function isNutritionV2Enabled(
  tenantHost: string,
  client: SupabaseClient = createSupabaseClient()
): Promise<boolean> {
  // Dev and test are always enabled; only production gates per-tenant.
  if (process.env.NODE_ENV !== "production") {
    return true;
  }

  const { data, error } = await client
    .from("tenants")
    .select("nutrition_v2_enabled")
    .eq("host", tenantHost)
    .maybeSingle();

  if (error !== null || data === null) {
    return false;
  }

  const row = data as { nutrition_v2_enabled?: boolean | null };

  return row.nutrition_v2_enabled === true;
}
