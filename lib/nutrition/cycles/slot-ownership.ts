import type { SupabaseClient } from "@supabase/supabase-js";

const SLOTS_TABLE = "meal_slots";
const OPTIONS_TABLE = "meal_slot_options";
const CYCLES_TABLE = "meal_cycles";

/**
 * Resolve a meal slot that belongs to the given client's OWN active cycle — the
 * §4.4 client-write boundary shared by selection and logging.
 *
 * Returns the slot's authoritative `tenantHost` (read from the slot row, never
 * the request) when the slot exists, its cycle's `client_id` matches `clientId`,
 * and that cycle is `active`. Returns `null` otherwise — a missing slot, another
 * client's slot, another tenant's slot, or a draft/archived cycle — which
 * callers map to a 404 with no write.
 */
export async function resolveClientActiveSlot(
  client: SupabaseClient,
  clientId: number,
  slotId: string
): Promise<{ tenantHost: string } | null> {
  const { data: slot, error: slotError } = await client
    .from(SLOTS_TABLE)
    .select("cycle_id, tenant_host")
    .eq("id", slotId)
    .maybeSingle();

  if (slotError !== null) {
    throw new Error(
      `resolveClientActiveSlot slot lookup: ${slotError.message}`
    );
  }

  if (slot === null) {
    return null;
  }

  const typedSlot = slot as { cycle_id: string; tenant_host: string };

  const { data: cycle, error: cycleError } = await client
    .from(CYCLES_TABLE)
    .select("client_id, status")
    .eq("id", typedSlot.cycle_id)
    .maybeSingle();

  if (cycleError !== null) {
    throw new Error(
      `resolveClientActiveSlot cycle lookup: ${cycleError.message}`
    );
  }

  const typedCycle = cycle as { client_id: number; status: string } | null;

  if (
    typedCycle === null ||
    typedCycle.client_id !== clientId ||
    typedCycle.status !== "active"
  ) {
    return null;
  }

  return { tenantHost: typedSlot.tenant_host };
}

/** Whether `optionId` is an option of `slotId` (for validating a chosen option). */
export async function optionBelongsToSlot(
  client: SupabaseClient,
  slotId: string,
  optionId: string
): Promise<boolean> {
  const { data, error } = await client
    .from(OPTIONS_TABLE)
    .select("id")
    .eq("id", optionId)
    .eq("slot_id", slotId)
    .maybeSingle();

  if (error !== null) {
    throw new Error(`optionBelongsToSlot lookup: ${error.message}`);
  }

  return data !== null;
}
