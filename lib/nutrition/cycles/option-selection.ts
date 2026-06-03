import type { SupabaseClient } from "@supabase/supabase-js";

const SELECTIONS_TABLE = "meal_slot_option_selections";
const SLOTS_TABLE = "meal_slots";
const OPTIONS_TABLE = "meal_slot_options";
const CYCLES_TABLE = "meal_cycles";

/** A row of `meal_slot_option_selections` (see migration 20260603092532). */
export interface OptionSelectionRow {
  id: string;
  tenant_host: string;
  client_id: number;
  slot_id: string;
  option_id: string;
  created_at: string;
  updated_at: string;
}

/** The client's standing choice per slot, for folding into the today view. */
export interface ClientSelection {
  slot_id: string;
  option_id: string;
}

/**
 * Set (or change) the authed client's option choice for a meal slot.
 *
 * §4.4 boundary: the slot must belong to the client's OWN cycle and that cycle
 * must be `active`, and the option must belong to that slot. Any mismatch —
 * another client's slot, another tenant's slot, a draft/archived cycle, or an
 * option from a different slot — returns `null` (the route maps that to 404),
 * and NO row is written. On success the choice is upserted on
 * `(client_id, slot_id)` so changing it never duplicates. The authoritative
 * `tenant_host` comes from the slot row, never the request.
 */
export async function setClientSelection(
  client: SupabaseClient,
  clientId: number,
  slotId: string,
  optionId: string
): Promise<OptionSelectionRow | null> {
  const { data: slot, error: slotError } = await client
    .from(SLOTS_TABLE)
    .select("id, cycle_id, tenant_host")
    .eq("id", slotId)
    .maybeSingle();

  if (slotError !== null) {
    throw new Error(`setClientSelection slot lookup: ${slotError.message}`);
  }

  if (slot === null) {
    return null;
  }

  const typedSlot = slot as {
    id: string;
    cycle_id: string;
    tenant_host: string;
  };

  // The slot's cycle must be the caller's own AND active.
  const { data: cycle, error: cycleError } = await client
    .from(CYCLES_TABLE)
    .select("client_id, status")
    .eq("id", typedSlot.cycle_id)
    .maybeSingle();

  if (cycleError !== null) {
    throw new Error(`setClientSelection cycle lookup: ${cycleError.message}`);
  }

  const typedCycle = cycle as { client_id: number; status: string } | null;

  if (
    typedCycle === null ||
    typedCycle.client_id !== clientId ||
    typedCycle.status !== "active"
  ) {
    return null;
  }

  // The option must belong to this slot.
  const { data: option, error: optionError } = await client
    .from(OPTIONS_TABLE)
    .select("id")
    .eq("id", optionId)
    .eq("slot_id", slotId)
    .maybeSingle();

  if (optionError !== null) {
    throw new Error(`setClientSelection option lookup: ${optionError.message}`);
  }

  if (option === null) {
    return null;
  }

  const { data, error } = await client
    .from(SELECTIONS_TABLE)
    .upsert(
      {
        tenant_host: typedSlot.tenant_host,
        client_id: clientId,
        slot_id: slotId,
        option_id: optionId,
      },
      { onConflict: "client_id,slot_id" }
    )
    .select()
    .single();

  if (error !== null) {
    throw new Error(`setClientSelection upsert: ${error.message}`);
  }

  return data as OptionSelectionRow;
}

/**
 * The client's standing selections (slot → chosen option). Scoped by
 * `client_id` (globally unique); slots/options that were deleted cascade out, so
 * only live choices remain. The view folds these in to mark the chosen option.
 */
export async function getClientSelections(
  client: SupabaseClient,
  clientId: number
): Promise<ClientSelection[]> {
  const { data, error } = await client
    .from(SELECTIONS_TABLE)
    .select("slot_id, option_id")
    .eq("client_id", clientId);

  if (error !== null) {
    throw new Error(`getClientSelections failed: ${error.message}`);
  }

  return (data ?? []) as ClientSelection[];
}
