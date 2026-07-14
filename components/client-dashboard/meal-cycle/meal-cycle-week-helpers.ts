/**
 * Pure helpers for the week-based client plan view. No DOM — the .tsx delegates
 * the Monday-of-week math and the "which dates have logs" set here so they are
 * unit-tested (no-jsdom convention).
 */

const MS_PER_DAY = 86_400_000;

/** A day of the client week, as far as these helpers care. */
interface DayLike {
  date: string;
  logs: Record<string, unknown>;
}

/** The Monday ("YYYY-MM-DD") of the calendar week containing `ymd`. */
export function mondayOf(ymd: string): string {
  const ms = ymdToMs(ymd);
  const dayOfWeek = new Date(ms).getUTCDay(); // 0=Sun … 6=Sat
  const daysSinceMonday = (dayOfWeek + 6) % 7; // Mon→0, Sun→6

  return msToYmd(ms - daysSinceMonday * MS_PER_DAY);
}

/** The set of dates in the week that have at least one logged meal. */
export function loggedDates(days: DayLike[]): Set<string> {
  const dates = new Set<string>();

  for (const day of days) {
    if (Object.keys(day.logs).length > 0) {
      dates.add(day.date);
    }
  }

  return dates;
}

function ymdToMs(ymd: string): number {
  const [year, month, day] = ymd.split("-");

  return Date.UTC(Number(year), Number(month) - 1, Number(day));
}

function msToYmd(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}
