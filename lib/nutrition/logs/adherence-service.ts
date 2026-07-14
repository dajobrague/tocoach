import type { AdherenceReport } from "./adherence";
import type { MealLogRow } from "./meal-log-service";
import type { SupabaseClient } from "@supabase/supabase-js";

import { buildPlannedDays, computeAdherence } from "./adherence";
import { getMealLogs } from "./meal-log-service";

import { getActiveCycleTreeForClient } from "@/lib/nutrition/cycles/client-cycle-reader";
import { groupSlotsByDay } from "@/lib/nutrition/cycles/cycle-day";

const CLIENTS_TABLE = "clients";

export interface AdherenceQuery {
  trainerId: string;
  clientId: number;
  from: string;
  to: string;
}

/** The trainer-facing payload: aggregate report + the raw logs (photos/comments). */
export interface AdherenceResult {
  report: AdherenceReport;
  logs: MealLogRow[];
}

/**
 * Whether `trainerId` owns `clientId`. Clients are owned via `clients.tenant`
 * (a FK to trainers.id), so a trainer can only see their own clients.
 */
export async function trainerOwnsClient(
  client: SupabaseClient,
  trainerId: string,
  clientId: number
): Promise<boolean> {
  const { data, error } = await client
    .from(CLIENTS_TABLE)
    .select("id")
    .eq("id", clientId)
    .eq("tenant", trainerId)
    .maybeSingle();

  if (error !== null) {
    throw new Error(`trainerOwnsClient lookup: ${error.message}`);
  }

  return data !== null;
}

/**
 * Assemble a trainer-facing adherence report for one of their clients over
 * `[from, to]`. Returns `null` when the trainer does not own the client
 * (the route maps that to 404) — the trainer-side §4.4 boundary. Planned meals
 * come from the client's active cycle; logged from their meal_logs.
 */
export async function getClientAdherence(
  client: SupabaseClient,
  query: AdherenceQuery
): Promise<AdherenceResult | null> {
  const owns = await trainerOwnsClient(client, query.trainerId, query.clientId);

  if (owns === false) {
    return null;
  }

  const tree = await getActiveCycleTreeForClient(client, query.clientId);
  const cycle =
    tree === null
      ? null
      : {
          startDate: tree.start_date,
          durationDays: tree.duration_days,
          plannedByDayIndex: groupSlotsByDay(
            tree.duration_days,
            tree.slots
          ).map((day) => day.slots.length),
        };

  const days = buildPlannedDays(query.from, query.to, cycle);
  const logs = await getMealLogs(client, query.clientId, query.from, query.to);
  const report = computeAdherence(
    days,
    logs.map((log) => ({ logDate: log.log_date, status: log.status }))
  );

  return { report, logs };
}
