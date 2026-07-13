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

/**
 * Whether the TRAINER-side nutrition-v2 tools (recipe library, importer,
 * cycle builder, diet PDFs, goal presets) are enabled for the tenant.
 *
 * True when either flag is set: `nutrition_v2_trainer_enabled` is the
 * prepare-phase switch (trainer builds in v2 while clients stay on legacy),
 * and a fully-flipped tenant (`nutrition_v2_enabled`) obviously has the tools
 * too. Same fail-closed semantics as {@link isNutritionV2Enabled}: any read
 * failure — missing tenant, missing column, query error — returns `false`.
 */
export async function isNutritionV2TrainerEnabled(
  tenantHost: string,
  client: SupabaseClient = createSupabaseClient()
): Promise<boolean> {
  if (process.env.NODE_ENV !== "production") {
    return true;
  }

  const { data, error } = await client
    .from("tenants")
    .select("nutrition_v2_enabled, nutrition_v2_trainer_enabled")
    .eq("host", tenantHost)
    .maybeSingle();

  if (error !== null || data === null) {
    return false;
  }

  const row = data as {
    nutrition_v2_enabled?: boolean | null;
    nutrition_v2_trainer_enabled?: boolean | null;
  };

  return (
    row.nutrition_v2_trainer_enabled === true ||
    row.nutrition_v2_enabled === true
  );
}
