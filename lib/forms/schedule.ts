/**
 * Check-in schedule resolution using IANA timezones via `Intl.DateTimeFormat`.
 * All instants are JavaScript `Date` (UTC internally); wall-clock math uses the schedule timezone.
 */

import {
  type CheckInFrequency,
  type CheckInSchedule,
  DEFAULT_CHECKIN_SCHEDULE,
} from "./types";

export { DEFAULT_CHECKIN_SCHEDULE };
export type { CheckInFrequency, CheckInSchedule };

/** From DB/API: may be null, undefined, partial, or a full {@link CheckInSchedule}. */
export type CheckInScheduleInput = Partial<CheckInSchedule> | null | undefined;

const MS_PER_MINUTE = 60 * 1000;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;
/** Seven-day windows from Unix epoch; used for N-week cadence parity (see `isIntervalInstantActive`). */
const WEEK_MS = 7 * MS_PER_DAY;
/**
 * Upper bound for `interval_weeks`. Clients can ask for up to a ~quarterly cadence
 * before the search windows in `findOpenCheckInWindow` / `findLastTriggerOnOrBefore`
 * need re-tuning.
 */
const MAX_INTERVAL_WEEKS = 12;

const SPANISH_DAYS = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
] as const;

/** Wall-clock parts for an instant in a given IANA timezone. */
type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function intFromParts(
  parts: Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes
): number {
  const raw = parts.find((p) => p.type === type)?.value ?? "0";

  return parseInt(raw, 10);
}

/**
 * Reads calendar + clock fields for `instant` as seen in `timeZone`.
 * Invalid IANA ids throw from `Intl`; we fall back to UTC so the app keeps running.
 */
function getZonedParts(instant: Date, timeZone: string): ZonedParts {
  try {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
      hour12: false,
    });
    const parts = dtf.formatToParts(instant);

    return {
      year: intFromParts(parts, "year"),
      month: intFromParts(parts, "month"),
      day: intFromParts(parts, "day"),
      hour: intFromParts(parts, "hour"),
      minute: intFromParts(parts, "minute"),
      second: intFromParts(parts, "second"),
    };
  } catch {
    return getZonedPartsUtc(instant);
  }
}

function getZonedPartsUtc(instant: Date): ZonedParts {
  return {
    year: instant.getUTCFullYear(),
    month: instant.getUTCMonth() + 1,
    day: instant.getUTCDate(),
    hour: instant.getUTCHours(),
    minute: instant.getUTCMinutes(),
    second: instant.getUTCSeconds(),
  };
}

function filterValidWeekdays(days: number[]): number[] {
  return [
    ...new Set(days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)),
  ].sort((a, b) => a - b);
}

/**
 * Converts a calendar date in the Gregorian calendar (interpreted as a plain date, no TZ)
 * to Sunday-based weekday: 0 = Sun … 6 = Sat (same as `Date#getDay()` for a UTC noon anchor).
 */
function weekdayUtcCalendar(year: number, month: number, day: number): number {
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0)).getUTCDay();
}

/** Adds `delta` calendar days to `(y, m, d)` using UTC date arithmetic. */
function addCalendarDays(
  y: number,
  m: number,
  d: number,
  delta: number
): [number, number, number] {
  const t = Date.UTC(y, m - 1, d + delta);
  const dt = new Date(t);

  return [dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate()];
}

function parseTime(time: string): [number, number] {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time.trim());

  if (!m) return [12, 0];

  const hh = m[1];
  const mm = m[2];

  if (hh === undefined || mm === undefined) return [12, 0];

  return [
    Math.min(23, Math.max(0, parseInt(hh, 10))),
    Math.min(59, Math.max(0, parseInt(mm, 10))),
  ];
}

/**
 * Finds the UTC instant when the wall-clock `(y, m, d, h, min)` occurs in `timeZone`.
 * Iteratively corrects for DST and calendar drift using `Intl`.
 */
function wallClockToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string
): Date {
  let guessMs = Date.UTC(year, month - 1, day, hour, minute, 0);

  for (let i = 0; i < 100; i++) {
    const p = getZonedParts(new Date(guessMs), timeZone);

    if (
      p.year === year &&
      p.month === month &&
      p.day === day &&
      p.hour === hour &&
      p.minute === minute
    ) {
      return new Date(guessMs);
    }

    if (p.year !== year || p.month !== month || p.day !== day) {
      guessMs +=
        Date.UTC(year, month - 1, day) - Date.UTC(p.year, p.month - 1, p.day);
      continue;
    }

    const deltaMin =
      (day - p.day) * 24 * 60 + (hour - p.hour) * 60 + (minute - p.minute);

    guessMs += deltaMin * MS_PER_MINUTE;
  }

  return new Date(guessMs);
}

/**
 * Whether `utcMs` falls on an "active" week for a cadence of one trigger every
 * `intervalWeeks` weeks. Anchored at the Unix epoch so that `intervalWeeks === 2`
 * reproduces the legacy biweekly parity (`floor(ms / WEEK_MS) % 2 === 0`).
 *
 * `intervalWeeks <= 1` → always active (plain weekly).
 */
function isIntervalInstantActive(
  utcMs: number,
  intervalWeeks: number
): boolean {
  if (!Number.isFinite(intervalWeeks) || intervalWeeks <= 1) return true;

  const n = Math.min(
    MAX_INTERVAL_WEEKS,
    Math.max(1, Math.round(intervalWeeks))
  );

  if (n === 1) return true;

  return Math.floor(utcMs / WEEK_MS) % n === 0;
}

function normalizeFrequency(f: CheckInFrequency | undefined): CheckInFrequency {
  if (f === "weekly" || f === "biweekly" || f === "custom") return f;

  return DEFAULT_CHECKIN_SCHEDULE.frequency;
}

/**
 * How far back/forward to walk calendar days when searching for triggers.
 * Scales with the cadence so an `interval_weeks = 6` schedule still finds at
 * least a couple of prior triggers.
 */
function maxSearchDaysFor(intervalWeeks: number): number {
  const n = Math.max(1, Math.round(intervalWeeks) || 1);

  // 120d covers ~17 weekly / ~8 fortnightly periods; scale up proportionally
  // for larger intervals, capped at a year to keep loops bounded.
  return Math.min(400, Math.max(120, n * 60));
}

function normalizeIntervalWeeks(raw: unknown): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return DEFAULT_CHECKIN_SCHEDULE.interval_weeks;
  }

  const n = Math.round(raw);

  if (!Number.isInteger(n) || n < 1) {
    return DEFAULT_CHECKIN_SCHEDULE.interval_weeks;
  }

  return Math.min(MAX_INTERVAL_WEEKS, n);
}

/**
 * Returns a full schedule, filling missing fields from {@link DEFAULT_CHECKIN_SCHEDULE}.
 *
 * @param schedule - Partial or missing schedule from API / DB (`null` / `undefined` → full default).
 * @returns A complete {@link CheckInSchedule} safe to pass to other helpers. Empty `custom_name` uses the default label.
 *
 * @example
 * ```ts
 * getScheduleOrDefault(null); // clone of DEFAULT_CHECKIN_SCHEDULE
 * getScheduleOrDefault({ time: "09:00" }); // defaults + 09:00 wall time
 * getScheduleOrDefault({ days_of_week: [1, 4] }); // Mon & Thu, rest defaulted
 * ```
 */
export function getScheduleOrDefault(
  schedule?: CheckInScheduleInput
): CheckInSchedule {
  if (schedule == null) return { ...DEFAULT_CHECKIN_SCHEDULE };

  const customRaw =
    typeof schedule.custom_name === "string" ? schedule.custom_name.trim() : "";
  const custom_name =
    customRaw.length > 0 ? customRaw : DEFAULT_CHECKIN_SCHEDULE.custom_name;

  // Silent legacy migration: `biweekly` → `weekly` + interval_weeks=2.
  // Only applied when the caller didn't explicitly set interval_weeks,
  // so an already-normalised row keeps its explicit value.
  const rawFrequency = normalizeFrequency(schedule.frequency);
  const rawInterval = schedule.interval_weeks;
  let frequency: CheckInFrequency = rawFrequency;
  let interval_weeks: number;

  if (rawFrequency === "biweekly") {
    frequency = "weekly";
    interval_weeks =
      typeof rawInterval === "number" && Number.isFinite(rawInterval)
        ? normalizeIntervalWeeks(rawInterval)
        : 2;
  } else {
    interval_weeks = normalizeIntervalWeeks(rawInterval);
  }

  return {
    ...DEFAULT_CHECKIN_SCHEDULE,
    ...schedule,
    frequency,
    interval_weeks,
    days_of_week: (() => {
      const raw = Array.isArray(schedule.days_of_week)
        ? schedule.days_of_week
        : [];
      const filtered = filterValidWeekdays(raw);

      return filtered.length > 0
        ? filtered
        : [...DEFAULT_CHECKIN_SCHEDULE.days_of_week];
    })(),
    times_per_week:
      typeof schedule.times_per_week === "number" &&
      Number.isFinite(schedule.times_per_week)
        ? schedule.times_per_week
        : DEFAULT_CHECKIN_SCHEDULE.times_per_week,
    grace_period_hours:
      typeof schedule.grace_period_hours === "number" &&
      Number.isFinite(schedule.grace_period_hours)
        ? schedule.grace_period_hours
        : DEFAULT_CHECKIN_SCHEDULE.grace_period_hours,
    enabled:
      typeof schedule.enabled === "boolean"
        ? schedule.enabled
        : DEFAULT_CHECKIN_SCHEDULE.enabled,
    time:
      typeof schedule.time === "string" && schedule.time.trim().length > 0
        ? schedule.time.trim()
        : DEFAULT_CHECKIN_SCHEDULE.time,
    timezone:
      typeof schedule.timezone === "string" &&
      schedule.timezone.trim().length > 0
        ? schedule.timezone.trim()
        : DEFAULT_CHECKIN_SCHEDULE.timezone,
    custom_name,
  };
}

/**
 * Builds a `Date` whose **UTC getters** mirror the current wall-clock in `timezone`.
 * Uses `Intl.DateTimeFormat#formatToParts` on real “now”, then `Date.UTC(...)`.
 * Handy when you want to compare “clock in Paris” without pulling in a date library.
 *
 * @param timezone - IANA id, e.g. `"Europe/Madrid"`.
 * @returns A `Date` whose `getUTCFullYear()`, `getUTCHours()`, etc. match that zone’s wall clock.
 *
 * @example
 * ```ts
 * const d = getCurrentTimeInTimezone("Europe/Madrid");
 * // If it is 14:30 in Madrid, d.getUTCHours() === 14 && d.getUTCMinutes() === 30
 * ```
 */
export function getCurrentTimeInTimezone(timezone: string): Date {
  const now = new Date();
  const p = getZonedParts(now, timezone);

  return new Date(
    Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  );
}

/** Sunday = 0 … Saturday = 6 in `timezone` for `instant` (same basis as {@link isDueNow}). */
export function getWallClockWeekdayInTimezone(
  instant: Date,
  timezone: string
): number {
  const p = getZonedParts(instant, timezone);

  return weekdayUtcCalendar(p.year, p.month, p.day);
}

/** Spanish weekday name for the calendar day of `instant` in `timezone`. */
export function getSpanishWeekdayLabelForInstant(
  instant: Date,
  timezone: string
): string {
  const dow = getWallClockWeekdayInTimezone(instant, timezone);

  return SPANISH_DAYS[dow] ?? `Día ${dow}`;
}

/**
 * Whether this instant matches the scheduled notification slot (day-of-week + clock).
 * Intended for a cron/job that runs **every minute** or **every hour** and only acts when this returns `true`.
 * Uses the schedule’s IANA `timezone` for weekday and for hour/minute comparison.
 *
 * @param schedule - Check-in schedule (coerced with {@link getScheduleOrDefault}).
 * @param now - Reference instant; defaults to `new Date()`.
 * @returns `true` when today (in zone) is in `days_of_week`, clock matches `time`, `enabled` is true,
 *          and biweekly parity passes when `frequency === "biweekly"`.
 *
 * @example
 * ```ts
 * // In your hourly worker:
 * if (isDueNow(schedule)) await sendCheckInReminder(clientId);
 * ```
 */
export function isDueNow(
  schedule: CheckInScheduleInput,
  now: Date = new Date()
): boolean {
  const s = getScheduleOrDefault(schedule);

  if (!s.enabled) return false;

  const p = getZonedParts(now, s.timezone);
  const dow = weekdayUtcCalendar(p.year, p.month, p.day);

  if (!s.days_of_week.includes(dow)) return false;

  const [th, tm] = parseTime(s.time);

  if (p.hour !== th || p.minute !== tm) return false;

  if (s.interval_weeks <= 1) return true;

  const trigger = wallClockToUtc(p.year, p.month, p.day, th, tm, s.timezone);

  return isIntervalInstantActive(trigger.getTime(), s.interval_weeks);
}

/**
 * Next upcoming trigger instant (UTC `Date`) after `fromDate`.
 * Walks forward in the schedule timezone’s calendar, tries each `days_of_week` at `time`,
 * and skips biweekly “off” weeks using `Math.floor(utcMs / WEEK_MS) % 2`.
 *
 * @param schedule - Check-in schedule.
 * @param fromDate - Only triggers **strictly after** this instant are considered.
 * @returns UTC instant of the next valid trigger; falls back to `+1 day` if none found in the search window.
 *
 * @example
 * ```ts
 * const next = getNextCheckInDate(schedule, new Date());
 * // Pass to calendar UI or `getCheckInDeadline(schedule, next)`
 * ```
 */
export function getNextCheckInDate(
  schedule: CheckInScheduleInput,
  fromDate: Date = new Date()
): Date {
  const s = getScheduleOrDefault(schedule);
  const [th, tm] = parseTime(s.time);
  const anchor = getZonedParts(fromDate, s.timezone);
  const maxDays = maxSearchDaysFor(s.interval_weeks);

  for (let delta = 0; delta <= maxDays; delta++) {
    const [y, mo, d] = addCalendarDays(
      anchor.year,
      anchor.month,
      anchor.day,
      delta
    );
    const dow = weekdayUtcCalendar(y, mo, d);

    if (!s.days_of_week.includes(dow)) continue;

    const trigger = wallClockToUtc(y, mo, d, th, tm, s.timezone);
    const t = trigger.getTime();

    if (t <= fromDate.getTime()) continue;
    if (!isIntervalInstantActive(t, s.interval_weeks)) continue;

    return trigger;
  }

  return new Date(fromDate.getTime() + MS_PER_DAY);
}

/**
 * Submission deadline for the check-in period that **opens** at `triggerDate`.
 * Adds `grace_period_hours` to that instant (0 or positive).
 *
 * @param schedule - Schedule (for `grace_period_hours`).
 * @param triggerDate - Period open time (usually from {@link getCheckInPeriodStart}).
 * @returns UTC instant = `triggerDate + grace_period_hours`.
 *
 * @example
 * ```ts
 * const start = getCheckInPeriodStart(schedule);
 * const lastCall = getCheckInDeadline(schedule, start);
 * ```
 */
export function getCheckInDeadline(
  schedule: CheckInScheduleInput,
  triggerDate: Date
): Date {
  const s = getScheduleOrDefault(schedule);
  const hours = Math.max(0, s.grace_period_hours);

  return new Date(triggerDate.getTime() + hours * MS_PER_HOUR);
}

/** Latest valid trigger instant on or before `referenceDate` (may be outside an open grace window). */
function findLastTriggerOnOrBefore(
  schedule: CheckInScheduleInput,
  referenceDate: Date
): Date {
  const s = getScheduleOrDefault(schedule);
  const [th, tm] = parseTime(s.time);
  const anchor = getZonedParts(referenceDate, s.timezone);
  let best: Date | null = null;
  const maxDays = maxSearchDaysFor(s.interval_weeks);

  for (let delta = 0; delta <= maxDays; delta++) {
    const [y, mo, d] = addCalendarDays(
      anchor.year,
      anchor.month,
      anchor.day,
      -delta
    );
    const dow = weekdayUtcCalendar(y, mo, d);

    if (!s.days_of_week.includes(dow)) continue;

    const trigger = wallClockToUtc(y, mo, d, th, tm, s.timezone);
    const t = trigger.getTime();

    if (t > referenceDate.getTime()) continue;
    if (!isIntervalInstantActive(t, s.interval_weeks)) continue;
    if (!best || t > best.getTime()) best = trigger;
  }

  return best ?? referenceDate;
}

/**
 * If `now` lies inside `[trigger, deadline]` for some scheduled slot, returns that window
 * (choosing the latest such trigger). Otherwise `null` (gap before the next slot, or after all searched history).
 */
function findOpenCheckInWindow(
  schedule: CheckInScheduleInput,
  now: Date
): { periodStart: Date; deadline: Date } | null {
  const s = getScheduleOrDefault(schedule);
  const [th, tm] = parseTime(s.time);
  const anchor = getZonedParts(now, s.timezone);
  let bestT: number | null = null;
  let bestStart: Date | null = null;
  const maxDays = maxSearchDaysFor(s.interval_weeks);
  const n = now.getTime();

  for (let delta = 0; delta <= maxDays; delta++) {
    const [y, mo, d] = addCalendarDays(
      anchor.year,
      anchor.month,
      anchor.day,
      -delta
    );
    const dow = weekdayUtcCalendar(y, mo, d);

    if (!s.days_of_week.includes(dow)) continue;

    const trigger = wallClockToUtc(y, mo, d, th, tm, s.timezone);
    const t = trigger.getTime();

    if (t > n) continue;
    if (!isIntervalInstantActive(t, s.interval_weeks)) continue;

    const deadlineMs = getCheckInDeadline(s, trigger).getTime();

    if (n >= t && n <= deadlineMs) {
      if (bestT === null || t > bestT) {
        bestT = t;
        bestStart = trigger;
      }
    }
  }

  if (bestStart === null) return null;

  return {
    periodStart: bestStart,
    deadline: getCheckInDeadline(s, bestStart),
  };
}

/**
 * Start of the check-in window for display/legacy week math:
 * if `referenceDate` falls inside an open `[trigger, deadline]` slot, returns **that** trigger
 * (latest matching slot); otherwise returns the latest trigger ≤ `referenceDate` (may be a closed period).
 * For `biweekly`, only triggers on “even” epoch weeks are considered (`floor(ms/7d) % 2 === 0`).
 *
 * @param schedule - Check-in schedule.
 * @param referenceDate - Usually `new Date()` (“now”).
 * @returns UTC instant of the chosen trigger.
 *
 * @example
 * ```ts
 * const periodStart = getCheckInPeriodStart(schedule, new Date());
 * ```
 */
export function getCheckInPeriodStart(
  schedule: CheckInScheduleInput,
  referenceDate: Date = new Date()
): Date {
  const open = findOpenCheckInWindow(schedule, referenceDate);

  if (open) return open.periodStart;

  return findLastTriggerOnOrBefore(schedule, referenceDate);
}

/**
 * End of the submission window for the period that began at `periodStart`.
 * Currently identical to `getCheckInDeadline(schedule, periodStart)` (trigger + grace).
 *
 * @param schedule - Check-in schedule.
 * @param periodStart - Output of {@link getCheckInPeriodStart} for the same period.
 * @returns Last valid moment to submit (inclusive when matching `submitted_at` against the window).
 *
 * @example
 * ```ts
 * const start = getCheckInPeriodStart(schedule);
 * const end = getCheckInPeriodEnd(schedule, start);
 * ```
 */
export function getCheckInPeriodEnd(
  schedule: CheckInScheduleInput,
  periodStart: Date
): Date {
  return getCheckInDeadline(schedule, periodStart);
}

/**
 * Deadline to show for UX: end of the **open** submission window, or — if none is open —
 * the deadline for the **next** upcoming check-in (after {@link getNextCheckInDate}).
 *
 * @example
 * ```ts
 * // In a gap between Monday and Thursday slots, returns Thu trigger + grace (not Mon + grace).
 * getEffectiveSubmissionDeadline(schedule, new Date());
 * ```
 */
export function getEffectiveSubmissionDeadline(
  schedule: CheckInScheduleInput,
  now: Date = new Date()
): Date {
  const s = getScheduleOrDefault(schedule);
  const open = findOpenCheckInWindow(s, now);

  if (open) return open.deadline;

  const next = getNextCheckInDate(s, now);

  return getCheckInDeadline(s, next);
}

function responseInWindow(
  submittedAt: string,
  periodStart: Date,
  deadline: Date
): boolean {
  const t = new Date(submittedAt).getTime();

  if (Number.isNaN(t)) return false;

  return t >= periodStart.getTime() && t <= deadline.getTime();
}

/**
 * `true` when the client is inside the open submission window and has not submitted yet.
 * Window is `[periodStart, deadline]` inclusive, where `periodStart` comes from {@link getCheckInPeriodStart}
 * and `deadline` from {@link getCheckInDeadline}.
 *
 * @param schedule - Check-in schedule.
 * @param responses - Prior submissions; a hit counts if `submitted_at` parses to a time inside the window.
 * @param now - Reference “now”; defaults to `new Date()`.
 * @returns `true` only when `now` is inside the window and no response falls in that window.
 *
 * @example
 * ```ts
 * isCheckInDue(schedule, [{ submitted_at: "2025-03-10T10:00:00.000Z" }], new Date());
 * ```
 */
export function isCheckInDue(
  schedule: CheckInScheduleInput,
  responses: { submitted_at: string }[],
  now: Date = new Date()
): boolean {
  const s = getScheduleOrDefault(schedule);

  if (!s.enabled) return false;

  const open = findOpenCheckInWindow(s, now);

  if (!open) return false;

  const done = responses.some((r) =>
    responseInWindow(r.submitted_at, open.periodStart, open.deadline)
  );

  return !done;
}

/**
 * High-level UI / API status for the current period.
 *
 * @param schedule - Check-in schedule (`enabled: false` → `"disabled"`).
 * @param responses - Submissions with ISO `submitted_at` strings.
 * @param now - Reference instant; defaults to `new Date()`.
 * @returns
 * - `"disabled"` — `schedule.enabled === false`
 * - `"completed"` — at least one response in the **open** `[trigger, deadline]` window
 * - `"pending"` — inside an open window, no qualifying response yet
 * - `"not_due"` — no open window and `now` is before the next trigger (`getNextCheckInDate`)
 * - `"expired"` — only if `now` is not before that next trigger (abnormal; e.g. search fallback)
 *
 * @example
 * ```ts
 * const chip = getCheckInStatus(schedule, responses);
 * if (chip === "pending") showCheckInForm();
 * ```
 */
export function getCheckInStatus(
  schedule: CheckInScheduleInput,
  responses: { submitted_at: string }[],
  now: Date = new Date()
): "pending" | "completed" | "expired" | "not_due" | "disabled" {
  const s = getScheduleOrDefault(schedule);

  if (!s.enabled) return "disabled";

  const t = now.getTime();
  const open = findOpenCheckInWindow(s, now);

  if (open) {
    const completed = responses.some((r) =>
      responseInWindow(r.submitted_at, open.periodStart, open.deadline)
    );

    if (completed) return "completed";

    return "pending";
  }

  const nextT = getNextCheckInDate(s, now);

  if (t < nextT.getTime()) return "not_due";

  return "expired";
}

function formatDaysSpanish(days: number[]): string {
  const labels = [...new Set(days)]
    .sort((a, b) => a - b)
    .map((d) => SPANISH_DAYS[d] ?? `Día ${d}`);

  if (labels.length === 0) return "";
  if (labels.length === 1) {
    const only = labels[0];

    return only ? only.toLowerCase() : "";
  }

  const head = labels.slice(0, -1).map((l) => l.toLowerCase());
  const tail = labels[labels.length - 1];

  return tail ? `${head.join(", ")} y ${tail.toLowerCase()}` : head.join(", ");
}

/**
 * Short Spanish phrase describing the schedule (for client-facing copy).
 *
 * @example
 * ```ts
 * formatScheduleDescription(DEFAULT_CHECKIN_SCHEDULE);
 * // "Cada lunes a las 12:00"
 * ```
 */
export function formatScheduleDescription(
  schedule: CheckInScheduleInput
): string {
  const s = getScheduleOrDefault(schedule);
  const [h, m] = parseTime(s.time);
  const timeStr = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  const days = formatDaysSpanish(s.days_of_week);
  const n = s.interval_weeks;

  // Legacy alias: some rows may still arrive with `biweekly` in-flight.
  // `getScheduleOrDefault` normalises these to interval_weeks=2, but guard anyway.
  if (s.frequency === "biweekly" && n < 2) {
    return `Cada dos semanas, los ${days} a las ${timeStr}`;
  }

  if (n <= 1) {
    return `Cada ${days} a las ${timeStr}`;
  }

  if (n === 2) {
    return `Cada dos semanas, los ${days} a las ${timeStr}`;
  }

  return `Cada ${n} semanas, los ${days} a las ${timeStr}`;
}
