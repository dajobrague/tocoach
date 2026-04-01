/**
 * Client progress charts: bucket form (and related) data by check-in schedule periods.
 */

import type { CheckInSchedule, FormResponse } from "./types";

import {
  getCheckInPeriodEnd,
  getCheckInPeriodStart,
  getNextCheckInDate,
  getScheduleOrDefault,
} from "./schedule";

const MONTH_ABBR_ES = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
] as const;

export type PeriodGroup = {
  periodStart: Date;
  periodEnd: Date;
  responses: FormResponse[];
  label: string;
};

export type ChartPeriodRow = {
  start: Date;
  end: Date;
  label: string;
};

/** UTC / wall-safe instant for sorting and bucketing. */
export function responseTimestampMs(r: FormResponse): number {
  if (typeof r.submitted_at === "string" && r.submitted_at.trim().length > 0) {
    const t = new Date(r.submitted_at).getTime();

    if (!Number.isNaN(t)) return t;
  }

  return new Date(`${r.response_date}T12:00:00.000Z`).getTime();
}

function zonedYMD(
  d: Date,
  timeZone: string
): { y: number; m: number; day: number } {
  try {
    const dtf = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const parts = dtf.formatToParts(d);
    const get = (t: Intl.DateTimeFormatPartTypes) =>
      parseInt(parts.find((p) => p.type === t)?.value ?? "0", 10);

    return { y: get("year"), m: get("month"), day: get("day") };
  } catch {
    return {
      y: d.getUTCFullYear(),
      m: d.getUTCMonth() + 1,
      day: d.getUTCDate(),
    };
  }
}

/**
 * Short range label, e.g. "18-24 Mar", "18 Mar - 1 Abr", using schedule timezone wall dates.
 */
export function formatPeriodRangeLabel(
  periodStart: Date,
  periodEnd: Date,
  timeZone: string
): string {
  const a = zonedYMD(periodStart, timeZone);
  const b = zonedYMD(periodEnd, timeZone);
  const ma = MONTH_ABBR_ES[a.m - 1] ?? "";
  const mb = MONTH_ABBR_ES[b.m - 1] ?? "";

  if (a.y === b.y && a.m === b.m) {
    return `${a.day}-${b.day} ${ma}`;
  }

  if (a.y === b.y) {
    return `${a.day} ${ma} - ${b.day} ${mb}`;
  }

  return `${a.day} ${ma} '${String(a.y).slice(-2)} - ${b.day} ${mb} '${String(b.y).slice(-2)}`;
}

/** Long caption for chart tooltips, e.g. "18 Mar 2025 – 24 Mar 2025". */
export function formatPeriodTooltipSpan(
  periodStart: Date,
  periodEnd: Date,
  timeZone: string
): string {
  const fmt = (d: Date) => {
    const { y, m, day } = zonedYMD(d, timeZone);
    const mo = MONTH_ABBR_ES[m - 1] ?? "";

    return `${day} ${mo} ${y}`;
  };

  return `${fmt(periodStart)} – ${fmt(periodEnd)}`;
}

/** `YYYY-MM-DD` for `d` in `timeZone` (for comparing to `response_date`). */
export function toYmdInTimezone(d: Date, timeZone: string): string {
  const { y, m, day } = zonedYMD(d, timeZone);

  return `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * `count` most recent periods (oldest → newest), including the period that contains `now`.
 */
export function generatePeriodLabels(
  schedule: CheckInSchedule,
  count: number,
  now: Date = new Date()
): ChartPeriodRow[] {
  const s = getScheduleOrDefault(schedule);
  const n = Math.max(0, Math.min(200, Math.floor(count)));
  const raw: ChartPeriodRow[] = [];
  let ref = new Date(now.getTime());

  for (let i = 0; i < n; i++) {
    const start = getCheckInPeriodStart(s, ref);
    const end = getCheckInPeriodEnd(s, start);
    const label = formatPeriodRangeLabel(start, end, s.timezone);

    raw.push({ start, end, label });
    ref = new Date(start.getTime() - 1);
  }

  return raw.reverse();
}

/**
 * Span from the start of the oldest requested period through the end of the newest.
 */
export function getChartDateRange(
  schedule: CheckInSchedule,
  periodsBack: number,
  now: Date = new Date()
): { from: Date; to: Date } {
  const rows = generatePeriodLabels(schedule, periodsBack, now);

  if (rows.length === 0) {
    return { from: now, to: now };
  }

  return {
    from: rows[0]!.start,
    to: rows[rows.length - 1]!.end,
  };
}

/**
 * All contiguous schedule periods from the period containing the earliest response
 * through the period containing the latest response (inclusive), with responses assigned.
 * Empty input returns [].
 */
export function groupResponsesByPeriod(
  responses: FormResponse[],
  schedule: CheckInSchedule
): PeriodGroup[] {
  const s = getScheduleOrDefault(schedule);

  if (responses.length === 0) return [];

  const times = responses.map(responseTimestampMs);
  const minT = Math.min(...times);
  const maxT = Math.max(...times);

  const firstStart = getCheckInPeriodStart(s, new Date(minT));
  const lastStart = getCheckInPeriodStart(s, new Date(maxT));

  const groups: PeriodGroup[] = [];
  let pStart = new Date(firstStart.getTime());
  let guard = 0;

  while (guard++ < 500 && pStart.getTime() <= lastStart.getTime()) {
    const end = getCheckInPeriodEnd(s, pStart);
    const label = formatPeriodRangeLabel(pStart, end, s.timezone);

    groups.push({
      periodStart: pStart,
      periodEnd: end,
      responses: [],
      label,
    });

    if (pStart.getTime() === lastStart.getTime()) {
      break;
    }

    pStart = getNextCheckInDate(s, end);
  }

  for (const r of responses) {
    const t = responseTimestampMs(r);

    for (const g of groups) {
      if (t >= g.periodStart.getTime() && t <= g.periodEnd.getTime()) {
        g.responses.push(r);

        break;
      }
    }
  }

  return groups;
}

/** Period buckets per dashboard range tab (tuned for readable charts). */
export function chartPeriodCountForRange(
  periodKey: string,
  frequency: CheckInSchedule["frequency"]
): number {
  const map: Record<string, number> = {
    "7d": 6,
    "30d": 12,
    "3m": 16,
    "6m": 20,
    "12m": 30,
  };

  let n = map[periodKey] ?? 10;

  if (frequency === "biweekly") {
    n = Math.max(4, Math.ceil(n / 2));
  }

  return n;
}

export function daysToFetchForChartRange(
  from: Date,
  now: Date = new Date()
): number {
  const spanMs = Math.max(0, now.getTime() - from.getTime());

  return Math.max(1, Math.ceil(spanMs / 86400000) + 3);
}
