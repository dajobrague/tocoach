import type { RecipeCountBucket, WeeklyLogBucket } from "./metrics-helpers";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  bucketLogsByWeek,
  intersectionCount,
  mondayOf,
  recipeCountDistribution,
  roundedAverage,
  tallyBy,
  weekStartsForRange,
} from "./metrics-helpers";

/**
 * Platform-wide nutrition-v2 success metrics (P6-T4).
 *
 * Cross-tenant aggregation — a true admin operation, so it runs with the
 * service-role client (bypasses RLS) per CLAUDE.md. The DB layer here only
 * fetches flat rows; all bucketing/averaging is delegated to the pure helpers
 * in metrics-helpers.ts. Inject `now`/`weeks` for deterministic tests.
 */

const DEFAULT_WEEKS = 12;
// Snapshot bound for the per-trainer row fetches. Far above any realistic
// platform size today; revisit (move to count() + an RPC GROUP BY) if the
// recipe/log tables ever approach this. Documented, not a silent cap.
const MAX_ROWS = 100_000;

export interface TrainerAdoption {
  /** Trainers whose tenant has nutrition_v2_enabled = true. */
  enabledCount: number;
  /** Of those, how many actually use it (≥1 recipe or ≥1 cycle). */
  usingCount: number;
}

export interface LibraryDepth {
  totalRecipes: number;
  /** Trainers with ≥1 recipe. */
  activeTrainerCount: number;
  avgRecipesPerActiveTrainer: number;
  distribution: RecipeCountBucket[];
}

export interface ClientLogging {
  weeks: WeeklyLogBucket[];
  /** Total logs within the window. */
  totalLogs: number;
  /** Distinct clients logging within the window. */
  distinctClients: number;
}

/**
 * Stubbed seam for the future complaint/satisfaction trend. NO complaint data
 * source exists yet, so this returns an explicit empty series — never
 * fabricated numbers — and the dashboard renders it as "coming soon".
 */
export interface ComplaintTrend {
  available: false;
  series: never[];
  note: string;
}

export interface NutritionMetrics {
  generatedAt: string;
  windowWeeks: number;
  adoption: TrainerAdoption;
  library: LibraryDepth;
  logging: ClientLogging;
  complaints: ComplaintTrend;
}

export interface MetricsOptions {
  /** Anchor "now" for the weekly window (defaults to the real now). */
  now?: Date;
  /** Number of weeks in the logging window (default 12). */
  weeks?: number;
}

/**
 * The complaint-trend stub. Kept as its own export so the seam is obvious and
 * the route/tests can assert it is explicitly unavailable.
 *
 * TODO(post-P6): wire to the real complaint/support data source once one
 * exists (e.g. a `support_tickets` table or a Zendesk/Intercom export). Until
 * then there is intentionally no series — do not synthesize one.
 */
export function complaintTrendStub(): ComplaintTrend {
  return {
    available: false,
    series: [],
    note: "Sin fuente de datos de quejas todavía — próximamente.",
  };
}

export async function computeNutritionMetrics(
  client: SupabaseClient,
  options: MetricsOptions = {}
): Promise<NutritionMetrics> {
  const weeks = options.weeks ?? DEFAULT_WEEKS;
  const now = options.now ?? new Date();
  const weekStarts = weekStartsForRange(now.toISOString().slice(0, 10), weeks);
  const windowStart = weekStarts[0]!;

  const [enabledTrainerIds, recipeRows, cycleRows, logRows] = await Promise.all(
    [
      fetchEnabledTrainerIds(client),
      fetchColumn<{ trainer_id: string | null }>(
        client,
        "recipes",
        "trainer_id"
      ),
      fetchColumn<{ trainer_id: string | null }>(
        client,
        "meal_cycles",
        "trainer_id"
      ),
      fetchLogRows(client, windowStart),
    ]
  );

  return {
    generatedAt: now.toISOString(),
    windowWeeks: weeks,
    adoption: shapeAdoption(enabledTrainerIds, recipeRows, cycleRows),
    library: shapeLibrary(recipeRows),
    logging: shapeLogging(logRows, weekStarts),
    complaints: complaintTrendStub(),
  };
}

function shapeAdoption(
  enabledTrainerIds: string[],
  recipeRows: Array<{ trainer_id: string | null }>,
  cycleRows: Array<{ trainer_id: string | null }>
): TrainerAdoption {
  const recipeTrainers = tallyBy(recipeRows, (row) => row.trainer_id);
  const cycleTrainers = tallyBy(cycleRows, (row) => row.trainer_id);
  const usingIds = new Set<string>([
    ...recipeTrainers.keys(),
    ...cycleTrainers.keys(),
  ]);

  return {
    enabledCount: enabledTrainerIds.length,
    usingCount: intersectionCount(enabledTrainerIds, usingIds),
  };
}

function shapeLibrary(
  recipeRows: Array<{ trainer_id: string | null }>
): LibraryDepth {
  const perTrainer = tallyBy(recipeRows, (row) => row.trainer_id);
  const totalRecipes = recipeRows.length;
  const activeTrainerCount = perTrainer.size;

  return {
    totalRecipes,
    activeTrainerCount,
    avgRecipesPerActiveTrainer: roundedAverage(
      totalRecipes,
      activeTrainerCount
    ),
    distribution: recipeCountDistribution([...perTrainer.values()]),
  };
}

function shapeLogging(
  logRows: Array<{ log_date: string; client_id: number }>,
  weekStarts: string[]
): ClientLogging {
  const weekSet = new Set(weekStarts);
  // Keep totals consistent with the displayed weeks (drop any future-dated
  // rows past the current week that the gte fetch let through).
  const inWindow = logRows.filter((row) => weekSet.has(mondayOf(row.log_date)));

  return {
    weeks: bucketLogsByWeek(inWindow, weekStarts),
    totalLogs: inWindow.length,
    distinctClients: new Set(inWindow.map((row) => row.client_id)).size,
  };
}

/** Trainer ids whose tenant has the nutrition_v2 flag on. */
async function fetchEnabledTrainerIds(
  client: SupabaseClient
): Promise<string[]> {
  const { data, error } = await client
    .from("tenants")
    .select("trainer_id")
    .eq("nutrition_v2_enabled", true)
    .not("trainer_id", "is", null)
    .limit(MAX_ROWS);

  if (error !== null) {
    throw new Error(`fetchEnabledTrainerIds failed: ${error.message}`);
  }

  return (data ?? [])
    .map((row) => (row as { trainer_id: string | null }).trainer_id)
    .filter((id): id is string => id !== null);
}

async function fetchColumn<T>(
  client: SupabaseClient,
  table: string,
  columns: string
): Promise<T[]> {
  const { data, error } = await client
    .from(table)
    .select(columns)
    .limit(MAX_ROWS);

  if (error !== null) {
    throw new Error(`fetch ${table}.${columns} failed: ${error.message}`);
  }

  return (data ?? []) as T[];
}

async function fetchLogRows(
  client: SupabaseClient,
  windowStart: string
): Promise<Array<{ log_date: string; client_id: number }>> {
  const { data, error } = await client
    .from("meal_logs")
    .select("log_date, client_id")
    .gte("log_date", windowStart)
    .limit(MAX_ROWS);

  if (error !== null) {
    throw new Error(`fetchLogRows failed: ${error.message}`);
  }

  return (data ?? []) as Array<{ log_date: string; client_id: number }>;
}
