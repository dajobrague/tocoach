import type { SupabaseClient } from "@supabase/supabase-js";

import { optionBelongsToSlot, resolveClientActiveSlot } from "./slot-ownership";

const SELECTIONS_TABLE = "meal_slot_option_selections";

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
  const owned = await resolveClientActiveSlot(client, clientId, slotId);

  if (owned === null) {
    return null;
  }

  // The option must belong to this slot.
  if ((await optionBelongsToSlot(client, slotId, optionId)) === false) {
    return null;
  }

  const { data, error } = await client
    .from(SELECTIONS_TABLE)
    .upsert(
      {
        tenant_host: owned.tenantHost,
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
