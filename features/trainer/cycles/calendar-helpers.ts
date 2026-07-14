/**
 * Pure calendar-grid helpers for the trainer overlay (P7-T3). No DOM, no
 * `Date.now()` — deterministic from a "YYYY-MM-DD" anchor, so unit-tested.
 */

const MS_PER_DAY = 86_400_000;
const MONTH_NAMES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

/** One cell of the month grid. */
export interface CalendarDay {
  /** "YYYY-MM-DD". */
  date: string;
  /** Whether it belongs to the anchor's month (vs leading/trailing padding). */
  inMonth: boolean;
}

function ymdToMs(ymd: string): number {
  const [year, month, day] = ymd.split("-");

  return Date.UTC(Number(year), Number(month) - 1, Number(day));
}

function msToYmd(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Add `days` to a "YYYY-MM-DD" date. */
export function addDays(ymd: string, days: number): string {
  return msToYmd(ymdToMs(ymd) + days * MS_PER_DAY);
}

/** The first day of the anchor's month, "YYYY-MM-01". */
export function firstOfMonth(ymd: string): string {
  return `${ymd.slice(0, 7)}-01`;
}

/** Shift the anchor by whole months (keeps day 01). */
export function shiftMonth(ymd: string, delta: number): string {
  const [year, month] = ymd.split("-").map(Number);
  const zeroBased = (year as number) * 12 + ((month as number) - 1) + delta;
  const newYear = Math.floor(zeroBased / 12);
  const newMonth = `${(zeroBased % 12) + 1}`.padStart(2, "0");

  return `${newYear}-${newMonth}-01`;
}

/** "junio 2026" for the anchor's month. */
export function monthTitle(ymd: string): string {
  const [year, month] = ymd.split("-").map(Number);

  return `${MONTH_NAMES[(month as number) - 1]} ${year}`;
}

/**
 * Monday-started weeks covering the anchor's whole month, with leading/trailing
 * days from the adjacent months as padding. Always whole weeks of 7.
 */
export function buildMonthGrid(ymd: string): CalendarDay[][] {
  const monthStart = firstOfMonth(ymd);
  const month = monthStart.slice(0, 7);
  // Back up to the Monday on/before the 1st.
  const dow = new Date(ymdToMs(monthStart)).getUTCDay(); // 0=Sun..6=Sat
  const gridStart = addDays(monthStart, -((dow + 6) % 7));

  const weeks: CalendarDay[][] = [];

  for (let week = 0; week < 6; week++) {
    const row: CalendarDay[] = [];

    for (let day = 0; day < 7; day++) {
      const date = addDays(gridStart, week * 7 + day);

      row.push({ date, inMonth: date.slice(0, 7) === month });
    }

    weeks.push(row);

    // Stop after the week that contains the last in-month day.
    const lastInRow = row[6]!.date;

    if (lastInRow.slice(0, 7) > month && week >= 3) {
      break;
    }
  }

  return weeks;
}

/** Day-of-month number (no leading zero) for a cell, e.g. "9". */
export function dayNumber(ymd: string): string {
  return `${Number(ymd.slice(8, 10))}`;
}
