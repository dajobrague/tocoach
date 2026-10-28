// Per-client engagement for the admin trainer page, computed from raw rows.
// A "training day" is a distinct (client, date) with at least one exercise
// log — a session logs one row per exercise, so raw row counts overstate it.

export const ACTIVITY_WEEKS = 12;

const DAY_MS = 86_400_000;

export interface TrainingRow {
  client_id: number | string;
  /** YYYY-MM-DD (training_date, or created_at's date as fallback). */
  day: string;
}

export interface FormRow {
  client_id: number | string;
  form_type: string;
  created_at: string;
}

export interface ClientActivity {
  /** Distinct training days in the last 28 days. */
  trainingDays28: number;
  /** Training days per week, oldest → newest, last 4 weeks. */
  weeks4: number[];
  lastTrainingDay: string | null;
  checkins28: number;
  habits28: number;
  lastCheckinAt: string | null;
}

export interface WeeklyActivity {
  /** Monday-agnostic: week i covers the 7 days ending `weekEnd`. */
  weekEnd: string;
  /** Distinct clients with ≥1 training day that week. */
  clients: number;
  /** Total distinct (client, day) training days that week. */
  trainingDays: number;
}

const emptyActivity = (): ClientActivity => ({
  trainingDays28: 0,
  weeks4: [0, 0, 0, 0],
  lastTrainingDay: null,
  checkins28: 0,
  habits28: 0,
  lastCheckinAt: null,
});

/** UTC midnight of `now` + 1 day, so "today" falls in week 0. */
function dayAfter(now: Date) {
  return Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1
  );
}

export function computeClientActivity(
  training: TrainingRow[],
  forms: FormRow[],
  now: Date = new Date()
) {
  const end = dayAfter(now);
  const byClient = new Map<string, ClientActivity>();
  const get = (id: number | string) => {
    const key = String(id);
    let a = byClient.get(key);

    if (!a) {
      a = emptyActivity();
      byClient.set(key, a);
    }

    return a;
  };

  const weekly = Array.from({ length: ACTIVITY_WEEKS }, () => ({
    clients: new Set<string>(),
    trainingDays: 0,
  }));

  const seen = new Set<string>();

  for (const row of training) {
    const key = `${row.client_id}|${row.day}`;

    if (seen.has(key)) continue;
    seen.add(key);

    const a = get(row.client_id);

    if (!a.lastTrainingDay || row.day > a.lastTrainingDay)
      a.lastTrainingDay = row.day;

    const daysAgo =
      Math.floor((end - Date.parse(`${row.day}T00:00:00Z`)) / DAY_MS) - 1;

    if (daysAgo < 0) continue; // future-dated log
    const week = Math.floor(daysAgo / 7);

    if (daysAgo < 28) {
      a.trainingDays28 += 1;
      a.weeks4[3 - week] = (a.weeks4[3 - week] ?? 0) + 1;
    }
    const bucket = weekly[ACTIVITY_WEEKS - 1 - week];

    if (bucket) {
      bucket.clients.add(String(row.client_id));
      bucket.trainingDays += 1;
    }
  }

  for (const f of forms) {
    const a = get(f.client_id);
    const daysAgo = (end - Date.parse(f.created_at)) / DAY_MS - 1;

    if (f.form_type === "checkins") {
      if (!a.lastCheckinAt || f.created_at > a.lastCheckinAt)
        a.lastCheckinAt = f.created_at;
      if (daysAgo < 28) a.checkins28 += 1;
    } else if (f.form_type === "habits" && daysAgo < 28) {
      a.habits28 += 1;
    }
  }

  const weeks: WeeklyActivity[] = weekly.map((w, i) => ({
    weekEnd: new Date(end - DAY_MS - (ACTIVITY_WEEKS - 1 - i) * 7 * DAY_MS)
      .toISOString()
      .slice(0, 10),
    clients: w.clients.size,
    trainingDays: w.trainingDays,
  }));

  return {
    activity: (id: number | string) =>
      byClient.get(String(id)) ?? emptyActivity(),
    weeks,
  };
}
