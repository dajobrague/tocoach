/**
 * Pure shaping/bucketing for the admin nutrition-v2 success metrics (P6-T4).
 *
 * The query layer (nutrition-metrics.ts) fetches flat rows with the service
 * role and delegates every aggregation here: ISO-week bucketing, per-trainer
 * tallies, the enabled∩using count, the recipe-count distribution and the
 * rounded average. Kept DB-free so all the math is unit-tested directly.
 */

const MS_PER_DAY = 86_400_000;

/** One week of meal-logging activity. */
export interface WeeklyLogBucket {
  /** Monday (UTC) of the week, "YYYY-MM-DD". */
  weekStart: string;
  /** Total meal logs that week. */
  logs: number;
  /** Distinct clients with ≥1 log that week. */
  distinctClients: number;
}

/** One band of the recipes-per-active-trainer distribution. */
export interface RecipeCountBucket {
  label: string;
  trainers: number;
}

/** The Monday (UTC) of the ISO week containing `ymd`, as "YYYY-MM-DD". */
export function mondayOf(ymd: string): string {
  const ms = ymdToMs(ymd);
  const dayOfWeek = new Date(ms).getUTCDay(); // 0=Sun … 6=Sat
  const daysSinceMonday = (dayOfWeek + 6) % 7; // Mon→0, Sun→6

  return msToYmd(ms - daysSinceMonday * MS_PER_DAY);
}

/**
 * The Monday week-starts for the last `numWeeks` weeks, oldest→newest, ending
 * with the week that contains `anchorYmd`.
 */
export function weekStartsForRange(
  anchorYmd: string,
  numWeeks: number
): string[] {
  const lastMonday = ymdToMs(mondayOf(anchorYmd));
  const starts: string[] = [];

  for (let offset = numWeeks - 1; offset >= 0; offset--) {
    starts.push(msToYmd(lastMonday - offset * 7 * MS_PER_DAY));
  }

  return starts;
}

/**
 * Bucket meal-log rows into the supplied week-starts. Each row is placed in the
 * Monday-week of its `log_date`; rows whose week is not in `weekStarts` are
 * dropped. Distinct clients are counted per week.
 */
export function bucketLogsByWeek(
  rows: Array<{ log_date: string; client_id: number }>,
  weekStarts: string[]
): WeeklyLogBucket[] {
  const index = new Map<string, { logs: number; clients: Set<number> }>();

  for (const weekStart of weekStarts) {
    index.set(weekStart, { logs: 0, clients: new Set() });
  }

  for (const row of rows) {
    const bucket = index.get(mondayOf(row.log_date));

    if (bucket === undefined) {
      continue;
    }

    bucket.logs += 1;
    bucket.clients.add(row.client_id);
  }

  return weekStarts.map((weekStart) => {
    const bucket = index.get(weekStart)!;

    return {
      weekStart,
      logs: bucket.logs,
      distinctClients: bucket.clients.size,
    };
  });
}

/** Count occurrences per string key across rows, skipping `null` keys. */
export function tallyBy<T>(
  rows: T[],
  key: (row: T) => string | null
): Map<string, number> {
  const tally = new Map<string, number>();

  for (const row of rows) {
    const k = key(row);

    if (k === null) {
      continue;
    }

    tally.set(k, (tally.get(k) ?? 0) + 1);
  }

  return tally;
}

/** How many members of `enabled` also appear in `using`. */
export function intersectionCount(
  enabled: string[],
  using: Iterable<string>
): number {
  const usingSet = new Set(using);

  return enabled.filter((id) => usingSet.has(id)).length;
}

/**
 * Bucket the per-active-trainer recipe counts into 1–5 / 6–20 / 21+. Counts of
 * 0 (not an active trainer) are ignored.
 */
export function recipeCountDistribution(counts: number[]): RecipeCountBucket[] {
  const buckets: RecipeCountBucket[] = [
    { label: "1–5", trainers: 0 },
    { label: "6–20", trainers: 0 },
    { label: "21+", trainers: 0 },
  ];

  for (const count of counts) {
    if (count <= 0) {
      continue;
    }

    if (count <= 5) {
      buckets[0]!.trainers += 1;
    } else if (count <= 20) {
      buckets[1]!.trainers += 1;
    } else {
      buckets[2]!.trainers += 1;
    }
  }

  return buckets;
}

/** Mean rounded to one decimal; returns 0 when the divisor is 0. */
export function roundedAverage(total: number, divisor: number): number {
  if (divisor <= 0) {
    return 0;
  }

  return Math.round((total / divisor) * 10) / 10;
}

/** Anchor a "YYYY-MM-DD" calendar date at UTC midnight. */
function ymdToMs(ymd: string): number {
  const [year, month, day] = ymd.split("-");

  return Date.UTC(Number(year), Number(month) - 1, Number(day));
}

/** The "YYYY-MM-DD" calendar date for a UTC-midnight-anchored millisecond. */
function msToYmd(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}
