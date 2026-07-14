import type { SupabaseClient } from "@supabase/supabase-js";

import {
  optionBelongsToSlot,
  resolveClientActiveSlot,
} from "@/lib/nutrition/cycles/slot-ownership";

const LOGS_TABLE = "meal_logs";

export type MealLogStatus = "eaten_planned" | "eaten_other" | "skipped";

export const MEAL_LOG_STATUSES: readonly MealLogStatus[] = [
  "eaten_planned",
  "eaten_other",
  "skipped",
];

/** A row of `meal_logs` (see migration 20260603095143). */
export interface MealLogRow {
  id: string;
  tenant_host: string;
  client_id: number;
  slot_id: string;
  option_id: string | null;
  log_date: string;
  status: MealLogStatus;
  comment: string | null;
  photo_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface SetMealLogInput {
  slotId: string;
  logDate: string;
  status: MealLogStatus;
  optionId?: string;
  comment?: string;
  photoUrl?: string;
}

/**
 * Set (or update) the authed client's log for one meal slot on one day.
 *
 * §4.4 boundary: the slot must belong to the client's OWN active cycle, and any
 * supplied `optionId` must belong to that slot. A mismatch returns `null` (route
 * → 404) and writes nothing. The choice upserts on
 * `(client_id, slot_id, log_date)` — one log per meal per day. `tenant_host`
 * comes from the slot row, never the request.
 */
export async function setMealLog(
  client: SupabaseClient,
  clientId: number,
  input: SetMealLogInput
): Promise<MealLogRow | null> {
  const owned = await resolveClientActiveSlot(client, clientId, input.slotId);

  if (owned === null) {
    return null;
  }

  if (input.optionId !== undefined) {
    const valid = await optionBelongsToSlot(
      client,
      input.slotId,
      input.optionId
    );

    if (valid === false) {
      return null;
    }
  }

  const payload: Record<string, unknown> = {
    tenant_host: owned.tenantHost,
    client_id: clientId,
    slot_id: input.slotId,
    log_date: input.logDate,
    status: input.status,
    option_id: input.optionId ?? null,
    comment: input.comment ?? null,
    photo_url: input.photoUrl ?? null,
  };

  const { data, error } = await client
    .from(LOGS_TABLE)
    .upsert(payload, { onConflict: "client_id,slot_id,log_date" })
    .select()
    .single();

  if (error !== null) {
    throw new Error(`setMealLog upsert: ${error.message}`);
  }

  return data as MealLogRow;
}

/**
 * The client's logs within `[from, to]` (inclusive ISO dates), ordered by date.
 * Scoped by `client_id` (globally unique) — the read boundary matching the rest
 * of the client-facing nutrition surface.
 */
export async function getMealLogs(
  client: SupabaseClient,
  clientId: number,
  from: string,
  to: string
): Promise<MealLogRow[]> {
  const { data, error } = await client
    .from(LOGS_TABLE)
    .select("*")
    .eq("client_id", clientId)
    .gte("log_date", from)
    .lte("log_date", to)
    .order("log_date", { ascending: true });

  if (error !== null) {
    throw new Error(`getMealLogs failed: ${error.message}`);
  }

  return (data ?? []) as MealLogRow[];
}
