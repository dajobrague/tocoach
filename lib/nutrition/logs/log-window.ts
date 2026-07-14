/**
 * The client logging window (pure, no DB / no `Date.now()`).
 *
 * A client may log a meal for a date only if it is today-or-earlier in their
 * timezone and no more than {@link MAX_LOG_DAYS_BACK} days ago. The server is
 * the real lock (POST /api/client/meal-logs); the week view's `canLog` and the
 * UI use the same predicate so they never disagree.
 */

const MS_PER_DAY = 86_400_000;

/** How far back a client may back-fill a log. */
export const MAX_LOG_DAYS_BACK = 30;

/** A valid "YYYY-MM-DD" calendar date (rejects shapes and impossible dates). */
export function isYmd(value: string): boolean {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value) === false) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00Z`);

  return (
    Number.isNaN(parsed.getTime()) === false &&
    parsed.toISOString().slice(0, 10) === value
  );
}

/** Shift a "YYYY-MM-DD" date by whole days. */
export function shiftYmd(ymd: string, days: number): string {
  return new Date(ymdToMs(ymd) + days * MS_PER_DAY).toISOString().slice(0, 10);
}

/**
 * Whether `dateYmd` is within the logging window relative to `todayYmd`:
 * on/before today and not more than `maxDaysBack` days before it. Both are
 * tz-less calendar dates (resolve "today" in the client tz before calling).
 */
export function isWithinLogWindow(
  dateYmd: string,
  todayYmd: string,
  maxDaysBack: number = MAX_LOG_DAYS_BACK
): boolean {
  if (dateYmd > todayYmd) {
    return false;
  }

  return dateYmd >= shiftYmd(todayYmd, -maxDaysBack);
}

function ymdToMs(ymd: string): number {
  const [year, month, day] = ymd.split("-");

  return Date.UTC(Number(year), Number(month) - 1, Number(day));
}
