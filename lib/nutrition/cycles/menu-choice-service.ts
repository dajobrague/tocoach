import type { SupabaseClient } from "@supabase/supabase-js";

const TABLE = "client_menu_choices";

/** A client's chosen plan menu (day_index) for one calendar date. */
export interface MenuChoiceRow {
  date: string;
  day_index: number;
  cycle_id: string;
}

/** The client's menu choices in [from, to] (inclusive, "YYYY-MM-DD"). */
export async function getMenuChoices(
  client: SupabaseClient,
  clientId: number,
  from: string,
  to: string
): Promise<MenuChoiceRow[]> {
  const { data, error } = await client
    .from(TABLE)
    .select("date, day_index, cycle_id")
    .eq("client_id", clientId)
    .gte("date", from)
    .lte("date", to);

  if (error !== null) {
    throw new Error(`getMenuChoices failed: ${error.message}`);
  }

  return (data ?? []) as MenuChoiceRow[];
}

/**
 * Set (or clear, with null) the client's menu choice for a date. Upserts on
 * (tenant_host, client_id, date); the caller validates that `dayIndex` is
 * within the active cycle and that `cycleId` IS the client's active cycle —
 * this function only persists.
 */
export async function setMenuChoice(
  client: SupabaseClient,
  tenantHost: string,
  clientId: number,
  cycleId: string,
  date: string,
  dayIndex: number | null
): Promise<void> {
  if (dayIndex === null) {
    const { error } = await client
      .from(TABLE)
      .delete()
      .eq("tenant_host", tenantHost)
      .eq("client_id", clientId)
      .eq("date", date);

    if (error !== null) {
      throw new Error(`setMenuChoice delete failed: ${error.message}`);
    }

    return;
  }

  const { error } = await client.from(TABLE).upsert(
    {
      tenant_host: tenantHost,
      client_id: clientId,
      cycle_id: cycleId,
      date,
      day_index: dayIndex,
    },
    { onConflict: "tenant_host,client_id,date" }
  );

  if (error !== null) {
    throw new Error(`setMenuChoice upsert failed: ${error.message}`);
  }
}
