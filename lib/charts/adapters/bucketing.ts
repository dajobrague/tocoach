/**
 * Shared bucketing helpers used by catalog adapters.
 *
 * Wraps the existing lib/forms/chart-helpers utilities (`generatePeriodLabels`,
 * `groupResponsesByPeriod`, `formatPeriodTooltipSpan`) so adapters don't
 * each duplicate the period-math.
 *
 * Aggregation reminder:
 *   daily          — one bucket per day in range
 *   weekly         — one bucket per ISO week (Mon-Sun) in range
 *   checkin_period — one bucket per trainer's check-in period (uses schedule)
 *   range_total    — one bucket for the whole range (used by ring/kpi)
 */

import type { CheckInSchedule, FormResponse } from "@/lib/forms/types";
import type { Aggregation, DateRange } from "../types";

import {
  formatPeriodRangeLabel,
  formatPeriodTooltipSpan,
  generatePeriodLabels,
  groupResponsesByPeriod,
  toYmdInTimezone,
} from "@/lib/forms/chart-helpers";
import { getNextCheckInDate } from "@/lib/forms/schedule";

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

/** Bucket window — one row per bucket (daily, weekly, checkin_period). */
export interface BucketWindow {
  start: Date;
  end: Date;
  label: string;
  /** Tooltip span text, e.g. "1 abr — 7 abr". */
  tooltip: string;
}

function dayLabel(d: Date): string {
  return `${d.getDate()} ${MONTH_ABBR_ES[d.getMonth()]}`;
}

function endOfDay(d: Date): Date {
  const e = new Date(d);

  e.setHours(23, 59, 59, 999);

  return e;
}

function startOfDay(d: Date): Date {
  const s = new Date(d);

  s.setHours(0, 0, 0, 0);

  return s;
}

function isoWeekStart(d: Date): Date {
  // Monday-anchored week start.
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  const start = new Date(d);

  start.setDate(start.getDate() + diff);

  return startOfDay(start);
}

/**
 * Generate the bucket windows for a given range + aggregation. Used by
 * adapters to know what slots they need to fill.
 *
 * For `range_total` returns a single window spanning the whole range —
 * adapters that want to render a ring or single number consume this.
 */
export function generateBuckets(
  range: DateRange,
  aggregation: Aggregation,
  schedule: CheckInSchedule
): BucketWindow[] {
  const tz = schedule.timezone;

  if (aggregation === "range_total") {
    return [
      {
        start: range.from,
        end: range.to,
        label: "Total",
        tooltip: formatPeriodTooltipSpan(range.from, range.to, tz),
      },
    ];
  }

  if (aggregation === "daily") {
    const days: BucketWindow[] = [];
    const cursor = startOfDay(range.from);
    const last = startOfDay(range.to);

    while (cursor <= last) {
      const dayEnd = endOfDay(cursor);

      days.push({
        start: new Date(cursor),
        end: dayEnd,
        label: dayLabel(cursor),
        tooltip: formatPeriodTooltipSpan(cursor, dayEnd, tz),
      });
      cursor.setDate(cursor.getDate() + 1);
    }

    return days;
  }

  if (aggregation === "weekly") {
    const weeks: BucketWindow[] = [];
    const cursor = isoWeekStart(range.from);

    while (cursor <= range.to) {
      const weekEnd = new Date(cursor);

      weekEnd.setDate(weekEnd.getDate() + 6);
      const end = endOfDay(weekEnd);

      weeks.push({
        start: new Date(cursor),
        end,
        label: dayLabel(cursor),
        tooltip: formatPeriodTooltipSpan(cursor, end, tz),
      });
      cursor.setDate(cursor.getDate() + 7);
    }

    return weeks;
  }

  // checkin_period — un bucket por ciclo entre check-ins.
  //
  // Cada bucket cubre desde el inicio del check-in (e.g., Lun 12:00)
  // hasta UN MILISEGUNDO antes del próximo check-in (Lun siguiente
  // 12:00, exclusivo). Antes el bucket end era `p.end` que es el
  // SUBMISSION DEADLINE del check-in (trigger + grace_period_hours,
  // típicamente 48h). Eso significa que para un schedule semanal
  // Mon 12:00 + 48h, cada bucket cubría sólo Mon-Wed 12:00 — y los
  // 4-5 días restantes (Wed 12:00 → próx Mon 12:00) caían en un
  // AGUJERO de agregación: respuestas del cliente con response_date
  // de Thursday-Sunday se descartaban silenciosamente del chart.
  //
  // Para CHECK-INS semanales (que sólo se llenan dentro del grace
  // window) el comportamiento no cambia: las respuestas siguen
  // cayendo en el mismo bucket. Para HABITS diarios, ahora todos
  // los días de la semana se aglomeran en su bucket correspondiente.
  //
  // El último bucket no tiene un "labels[i+1]" para inferir el
  // próximo inicio, así que pedimos `getNextCheckInDate` desde el
  // final del periodo. Para schedules con múltiples slots por
  // semana, esa función ya respeta el siguiente slot legítimo.
  const labels = generatePeriodLabels(
    schedule,
    Math.max(1, estimatePeriodCount(range, schedule))
  );

  return labels.map((p, i) => {
    const nextStart =
      i + 1 < labels.length
        ? labels[i + 1]!.start
        : getNextCheckInDate(schedule, p.end);
    const end = new Date(nextStart.getTime() - 1);
    const label = formatPeriodRangeLabel(p.start, end, tz);

    return {
      start: p.start,
      end,
      label,
      tooltip: formatPeriodTooltipSpan(p.start, end, tz),
    };
  });
}

/**
 * Rough estimate of how many check-in periods fit in the range. The
 * `generatePeriodLabels` helper itself decides the exact slice; we just
 * need to ask for "enough" rows.
 */
function estimatePeriodCount(
  range: DateRange,
  schedule: CheckInSchedule
): number {
  const days = Math.max(
    1,
    Math.ceil((range.to.getTime() - range.from.getTime()) / 86400000)
  );
  // Approximate: 7 days * interval_weeks (defaults to 1). biweekly is
  // expressed as interval_weeks=2 in this codebase.
  const periodDays =
    Math.max(1, schedule.interval_weeks ?? 1) *
    (schedule.frequency === "biweekly" ? 14 : 7);

  return Math.ceil(days / Math.max(1, periodDays)) + 1;
}

/**
 * Average over a list of `value` extracted from form responses inside a
 * window. Skips entries where the resolver returns null (i.e. the client
 * didn't report that field), so a missing day doesn't dilute the mean.
 *
 * Returns null when no responses had a value. Caller decides whether to
 * coerce to 0 for rendering.
 */
export function averageInWindow<T extends FormResponse>(
  responses: T[],
  window: BucketWindow,
  resolve: (r: T) => number | null,
  schedule: CheckInSchedule
): number | null {
  const tz = schedule.timezone;
  const startYmd = toYmdInTimezone(window.start, tz);
  const endYmd = toYmdInTimezone(window.end, tz);

  let sum = 0;
  let count = 0;

  for (const r of responses) {
    const ymd = r.response_date;

    if (!ymd) continue;
    if (ymd < startYmd || ymd > endYmd) continue;
    const v = resolve(r);

    if (v === null) continue;
    sum += v;
    count += 1;
  }

  if (count === 0) return null;

  return sum / count;
}

/**
 * Sum across responses in a window (for counts like training sessions).
 */
export function sumInWindow<T extends { scheduled_date?: string | null }>(
  items: T[],
  window: BucketWindow,
  classifier: (item: T) => boolean,
  schedule: CheckInSchedule
): number {
  const tz = schedule.timezone;
  const startYmd = toYmdInTimezone(window.start, tz);
  const endYmd = toYmdInTimezone(window.end, tz);

  let count = 0;

  for (const item of items) {
    const ymd = item.scheduled_date;

    if (!ymd) continue;
    if (ymd < startYmd || ymd > endYmd) continue;
    if (classifier(item)) count += 1;
  }

  return count;
}

/**
 * Group form responses by check-in period using the existing
 * groupResponsesByPeriod helper. Re-exported so adapters can pull it
 * from one place.
 */
export { groupResponsesByPeriod };
