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
  formatPeriodTooltipSpan,
  generatePeriodLabels,
  groupResponsesByPeriod,
  toYmdInTimezone,
} from "@/lib/forms/chart-helpers";

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

/**
 * Format Y-M-D string ("2026-05-07") como label corto "7 May".
 * Usado por buckets diarios que iteran por string YMD (no Date) para
 * evitar drift de huso entre construcción y comparación.
 */
function dayLabelFromYmd(ymd: string): string {
  const [, m, d] = ymd.split("-").map(Number);
  const monthIdx = (m ?? 1) - 1;

  return `${d} ${MONTH_ABBR_ES[monthIdx] ?? ""}`;
}

/**
 * Suma 1 día a un Y-M-D string. Robusto contra fines de mes/año
 * porque delega en Date (UTC midnight + 24h, luego re-extrae YMD).
 */
function addDayYmd(ymd: string): string {
  const ms = Date.parse(`${ymd}T00:00:00Z`);
  const next = new Date(ms + 86400000);
  const y = next.getUTCFullYear();
  const m = String(next.getUTCMonth() + 1).padStart(2, "0");
  const d = String(next.getUTCDate()).padStart(2, "0");

  return `${y}-${m}-${d}`;
}

/**
 * Construye un Date que representa "mediodía en la zona `tz` del día
 * `ymd`". Usado como punto único para start/end de un bucket diario:
 * tanto start como end resuelven al MISMO YMD via toYmdInTimezone,
 * eliminando el doble conteo que causaba el bucket end=23:59:59 UTC
 * cuando se evaluaba en husos al este de UTC.
 *
 * Algoritmo: probamos UTC mediodía como candidato; si la conversión
 * a `tz` cae fuera del YMD esperado (por offsets extremos UTC+13/+14
 * o UTC-12), shifteamos ±12h. Iteración acotada a ≤2 pasos.
 */
function tzNoon(ymd: string, tz: string): Date {
  let candidate = Date.parse(`${ymd}T12:00:00Z`);

  for (let i = 0; i < 2; i++) {
    const got = toYmdInTimezone(new Date(candidate), tz);

    if (got === ymd) return new Date(candidate);
    candidate += got < ymd ? 12 * 3600 * 1000 : -12 * 3600 * 1000;
  }

  return new Date(candidate);
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
    // Iteramos por strings YMD en huso del schedule, no por Date
    // server-local. Antes generábamos cursor=startOfDay(range.from)
    // y dayEnd=endOfDay(cursor) usando el clock del servidor (UTC en
    // Vercel/Railway). El filtro `averageInWindow` después convertía
    // esos boundaries a YMD en schedule.tz vía toYmdInTimezone, y
    // como endOfDay=23:59:59 UTC cae en las 01:59 del DÍA SIGUIENTE
    // en Madrid (UTC+2), el endYmd del bucket "May 6" terminaba en
    // "2026-05-07". Resultado: una respuesta con response_date=
    // "2026-05-07" caía DENTRO del rango YMD del bucket del 6 Y del
    // bucket del 7 → doble conteo, dato duplicado en charts.
    //
    // Ahora construimos un YMD string en schedule.tz para cada
    // bucket y armamos un Date "representativo" de mediodía en esa
    // tz (`tzNoon`) como punto único — start y end del bucket
    // resuelven al MISMO YMD garantizado.
    const days: BucketWindow[] = [];
    const fromYmd = toYmdInTimezone(range.from, tz);
    const toYmd = toYmdInTimezone(range.to, tz);

    let cursorYmd = fromYmd;
    let guard = 0;

    while (cursorYmd <= toYmd && guard++ < 400) {
      const noon = tzNoon(cursorYmd, tz);

      days.push({
        start: noon,
        end: noon,
        label: dayLabelFromYmd(cursorYmd),
        tooltip: formatPeriodTooltipSpan(noon, noon, tz),
      });
      cursorYmd = addDayYmd(cursorYmd);
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

  // checkin_period
  const labels = generatePeriodLabels(
    schedule,
    Math.max(1, estimatePeriodCount(range, schedule))
  );

  return labels.map((p) => ({
    start: p.start,
    end: p.end,
    label: p.label,
    tooltip: formatPeriodTooltipSpan(p.start, p.end, tz),
  }));
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
