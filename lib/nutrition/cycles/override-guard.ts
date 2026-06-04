import type { MealCycleRow } from "./meal-cycle-service";
import type { SupabaseClient } from "@supabase/supabase-js";

import { MealCycleService } from "./meal-cycle-service";

import { trainerOwnsClient } from "@/lib/nutrition/logs/adherence-service";

/**
 * Resolve a cycle only when the authed trainer owns it: it must belong to the
 * trainer's tenant (tenant_host scoping) AND the trainer must own the cycle's
 * client (clients.tenant = trainer id — the §4.4 trainer boundary). Returns
 * `null` on either miss, which the route maps to 404 with no write — so a
 * cross-tenant or not-your-client cycle is indistinguishable from "not found".
 */
export async function resolveOwnedCycle(
  client: SupabaseClient,
  tenantHost: string,
  trainerId: string,
  cycleId: string
): Promise<MealCycleRow | null> {
  const cycle = await new MealCycleService(client).getById(tenantHost, cycleId);

  if (cycle === null) {
    return null;
  }

  const owns = await trainerOwnsClient(client, trainerId, cycle.client_id);

  return owns ? cycle : null;
}
