import type { SupabaseClient } from "@supabase/supabase-js";

import { resolveClientActiveSlot } from "./slot-ownership";

const SELECTIONS_TABLE = "meal_slot_option_selections";
const OPTIONS_TABLE = "meal_slot_options";

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

/** One selected option of the client (a slot may have one per component). */
export interface ClientSelection {
  slot_id: string;
  option_id: string;
}

/**
 * Set (or change) the authed client's option choice for one meal COMPONENT.
 *
 * §4.4 boundary: the slot must belong to the client's OWN cycle and that cycle
 * must be `active`, and the option must belong to that slot. Any mismatch —
 * another client's slot, another tenant's slot, a draft/archived cycle, or an
 * option from a different slot — returns `null` (the route maps that to 404),
 * and NO row is written.
 *
 * Options sharing a `group_index` are alternatives, so the client's other
 * picks in the SAME group are deleted first; picks in other groups of the slot
 * are left alone (they sum toward the meal). The row upserts on
 * `(client_id, option_id)`. The authoritative `tenant_host` comes from the
 * slot row, never the request.
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

  const { data: options, error: optionsError } = await client
    .from(OPTIONS_TABLE)
    .select("id, group_index")
    .eq("slot_id", slotId);

  if (optionsError !== null) {
    throw new Error(`setClientSelection options: ${optionsError.message}`);
  }

  const rows = (options ?? []) as { id: string; group_index: number }[];
  const target = rows.find((row) => row.id === optionId);

  // The option must belong to this slot.
  if (target === undefined) {
    return null;
  }

  const siblingIds = rows
    .filter(
      (row) => row.group_index === target.group_index && row.id !== optionId
    )
    .map((row) => row.id);

  // ponytail: delete + upsert is not atomic; a failure between them leaves the
  // component unselected (falls back to its first option), never double-picked.
  if (siblingIds.length > 0) {
    const { error: deleteError } = await client
      .from(SELECTIONS_TABLE)
      .delete()
      .eq("client_id", clientId)
      .in("option_id", siblingIds);

    if (deleteError !== null) {
      throw new Error(`setClientSelection deselect: ${deleteError.message}`);
    }
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
      { onConflict: "client_id,option_id" }
    )
    .select()
    .single();

  if (error !== null) {
    throw new Error(`setClientSelection upsert: ${error.message}`);
  }

  return data as OptionSelectionRow;
}

/**
 * The client's standing selections (one row per selected option). Scoped by
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
