import type { MealCycleRow, MealCycleTree } from "./meal-cycle-service";
import type { SupabaseClient } from "@supabase/supabase-js";

import { MealCycleService } from "./meal-cycle-service";

const CYCLES_TABLE = "meal_cycles";

/**
 * The client-facing read for the meal-cycle "today" view (P4 / §4.4). Kept
 * separate from the trainer CRUD in MealCycleService so the auth boundary lives
 * in one clearly-named place.
 *
 * Returns the authed client's single active cycle as a full slots → options
 * tree, or `null` if they have none.
 *
 * The security boundary is `client_id`: it is a globally-unique FK to
 * `clients(id)`, and the partial-unique index
 * `meal_cycles_one_active_per_client_idx` guarantees at most one active cycle
 * per client — so the row this returns is unambiguously the caller's OWN cycle
 * and never another client's. It takes NO request-supplied `tenantHost`; the
 * tree is read using the cycle row's own authoritative `tenant_host`, so a
 * client can reach neither across clients nor across tenants. A draft/archived
 * cycle yields `null`.
 */
export async function getActiveCycleTreeForClient(
  client: SupabaseClient,
  clientId: number
): Promise<MealCycleTree | null> {
  const { data, error } = await client
    .from(CYCLES_TABLE)
    .select("*")
    .eq("client_id", clientId)
    .eq("status", "active")
    .maybeSingle();

  if (error !== null) {
    throw new Error(`getActiveCycleTreeForClient failed: ${error.message}`);
  }

  if (data === null) {
    return null;
  }

  const cycle = data as MealCycleRow;

  return new MealCycleService(client).getByIdWithTree(
    cycle.tenant_host,
    cycle.id
  );
}
