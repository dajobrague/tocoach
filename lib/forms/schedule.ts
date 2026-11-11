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
  s: Pick<
    CheckInSchedule,
    "interval_weeks" | "grace_period_hours" | "timezone" | "first_close_date"
  >
): boolean {
  const n = Number.isFinite(s.interval_weeks)
    ? Math.min(MAX_INTERVAL_WEEKS, Math.max(1, Math.round(s.interval_weeks)))
    : 1;
  const first = parseYmd(s.first_close_date);

  if (first) {
    // Con primer check-in elegido por el entrenador: nada cierra antes de esa
    // fecha y las semanas se cuentan desde ella. Días de calendario en la
    // zona del check-in (no ms) para que el cambio de hora no mueva la semana.
    const close = getZonedParts(
      new Date(utcMs + Math.max(0, s.grace_period_hours) * MS_PER_HOUR),
      s.timezone
    );
    const days = Math.round(
      (Date.UTC(close.year, close.month - 1, close.day) -
        Date.UTC(first[0], first[1] - 1, first[2])) /
        MS_PER_DAY
    );

    return days >= 0 && Math.floor(days / 7) % n === 0;
  }

  if (n === 1) return true;

  return Math.floor(utcMs / WEEK_MS) % n === 0;
}

const toYmd = (y: number, mo: number, d: number) =>
  `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/** Fecha de cierre ("YYYY-MM-DD", zona del check-in) de la ventana que abre en `trigger`. */
export function checkInCloseYmd(
  s: Pick<CheckInSchedule, "grace_period_hours" | "timezone">,
  trigger: Date
): string {
  const p = getZonedParts(
    new Date(
      trigger.getTime() + Math.max(0, s.grace_period_hours) * MS_PER_HOUR
    ),
    s.timezone
  );

  return toYmd(p.year, p.month, p.day);
}

/** Apertura que da la regla ese día (día de la semana + semana activa), sin excepciones. */
function regularTriggerOnDay(
  s: CheckInSchedule,
  y: number,
  mo: number,
  d: number
): Date | null {
  if (!s.days_of_week.includes(weekdayUtcCalendar(y, mo, d))) return null;
  const [th, tm] = parseTime(s.time);
  const trigger = wallClockToUtc(y, mo, d, th, tm, s.timezone);

  return isIntervalInstantActive(trigger.getTime(), s) ? trigger : null;
}

/**
 * Apertura real ese día: la de la regla, salvo que ese check-in se haya
 * quitado o movido (`exceptions`), más cualquier check-in movido A ese día.
 * Todas las búsquedas de fechas pasan por aquí.
 */
function triggerOnDay(
  s: CheckInSchedule,
  y: number,
  mo: number,
  d: number
): Date | null {
  const regular = regularTriggerOnDay(s, y, mo, d);
  const ex = s.exceptions;

  if (!ex) return regular;
  if (regular && !Object.hasOwn(ex, checkInCloseYmd(s, regular))) {
    return regular;
  }

  for (const [from, to] of Object.entries(ex)) {
    const a = parseYmd(from);
    const b = parseYmd(to);

    if (!a || !b) continue;
    const shift = Math.round(
      (Date.UTC(b[0], b[1] - 1, b[2]) - Date.UTC(a[0], a[1] - 1, a[2])) /
        MS_PER_DAY
    );
    const [oy, om, od] = addCalendarDays(y, mo, d, -shift);
    const original = regularTriggerOnDay(s, oy, om, od);

    if (original && checkInCloseYmd(s, original) === from) {
      const [th, tm] = parseTime(s.time);

      return wallClockToUtc(y, mo, d, th, tm, s.timezone);
    }
  }

  return null;
}

/**
 * Mueve (`to` = fecha), quita (`to` = null) o restaura (`to` = undefined) el
 * check-in que cierra en `closeYmd`. Si ese check-in ya venía movido, se
 * actualiza su excepción original en vez de encadenar otra.
 */
export function setCheckInException(
  s: CheckInSchedule,
  closeYmd: string,
  to: string | null | undefined
): CheckInSchedule {
  const exceptions = { ...s.exceptions };
  const source =
    Object.keys(exceptions).find((k) => exceptions[k] === closeYmd) ?? closeYmd;

  if (to === undefined || to === source) delete exceptions[source];
  else exceptions[source] = to;

  return { ...s, exceptions };
}

/** "YYYY-MM-DD" → [year, month (1-12), day]; null si falta o no es una fecha real. */
export function parseYmd(
  value: string | null | undefined
): [number, number, number] | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? "");

  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));

  return date.getUTCMonth() === mo - 1 && date.getUTCDate() === d
    ? [y, mo, d]
    : null;
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
  const [th, tm] = parseTime(s.time);

  if (p.hour !== th || p.minute !== tm) return false;

  return triggerOnDay(s, p.year, p.month, p.day) !== null;
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
  // Con un primer check-in lejano, la búsqueda arranca cerca de él en vez de
  // agotar la ventana de días antes de llegar.
  const first = parseYmd(s.first_close_date);
  const searchFrom = first
    ? new Date(
        Math.max(
          fromDate.getTime(),
          Date.UTC(first[0], first[1] - 1, first[2]) -
            (Math.max(0, s.grace_period_hours) + 48) * MS_PER_HOUR
        )
      )
    : fromDate;
  const anchor = getZonedParts(searchFrom, s.timezone);
  const maxDays = maxSearchDaysFor(s.interval_weeks);

  for (let delta = 0; delta <= maxDays; delta++) {
    const [y, mo, d] = addCalendarDays(
      anchor.year,
      anchor.month,
      anchor.day,
      delta
    );
    const trigger = triggerOnDay(s, y, mo, d);

    if (!trigger) continue;
    const t = trigger.getTime();

    if (t <= fromDate.getTime()) continue;

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
    const trigger = triggerOnDay(s, y, mo, d);

    if (!trigger) continue;
    const t = trigger.getTime();

    if (t > referenceDate.getTime()) continue;
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
    const trigger = triggerOnDay(s, y, mo, d);

    if (!trigger) continue;
    const t = trigger.getTime();

    if (t > n) continue;

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
  now: Date = new Date(),
  /** Alta del cliente: ventanas abiertas antes no cuentan como no enviadas. */
  since?: Date
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

  // Sin ventana abierta: si la última que se cerró quedó sin respuesta, el
  // check-in está sin enviar ("expired") hasta que abra la siguiente. Una
  // respuesta tardía (tras el cierre) también cuenta como enviada.
  const last = findLastTriggerOnOrBefore(s, now);

  if (
    last.getTime() < t &&
    (!since || last.getTime() >= since.getTime()) &&
    !responses.some((r) => new Date(r.submitted_at).getTime() >= last.getTime())
  ) {
    return "expired";
  }

  const nextT = getNextCheckInDate(s, now);

  if (t < nextT.getTime()) return "not_due";

  return "expired";
}

export interface CheckInOccurrence {
  /** Instante en que se abre la ventana. */
  opensAt: Date;
  /** Instante en que se cierra (apertura + margen). */
  closesAt: Date;
}

/**
 * Próximas ocurrencias del check-in en orden: la ventana abierta ahora (si la
 * hay) y después las siguientes. Vacío si el check-in está desactivado.
 */
export function getUpcomingCheckIns(
  schedule: CheckInScheduleInput,
  count: number,
  now: Date = new Date()
): CheckInOccurrence[] {
  const s = getScheduleOrDefault(schedule);

  if (!s.enabled) return [];

  const out: CheckInOccurrence[] = [];
  const open = findOpenCheckInWindow(s, now);
  let from = now;

  if (open) {
    out.push({ opensAt: open.periodStart, closesAt: open.deadline });
    from = open.periodStart;
  }

  while (out.length < count) {
    const opensAt = getNextCheckInDate(s, from);

    out.push({ opensAt, closesAt: getCheckInDeadline(s, opensAt) });
    from = opensAt;
  }

  return out.slice(0, Math.max(0, count));
}

/** Ventana abierta en este momento, o null. */
export function getOpenCheckIn(
  schedule: CheckInScheduleInput,
  now: Date = new Date()
): CheckInOccurrence | null {
  const open = findOpenCheckInWindow(getScheduleOrDefault(schedule), now);

  return open ? { opensAt: open.periodStart, closesAt: open.deadline } : null;
}

const MS_HOUR = MS_PER_HOUR;

/**
 * Qué aviso toca en una pasada HORARIA del cron (cada ventana recibe cada
 * aviso una sola vez, sea cual sea el minuto de apertura):
 * - "opened": la ventana abrió en la última hora.
 * - "closing": queda el margen de aviso (24 h, o la mitad del plazo si es
 *   más corto) para el cierre.
 */
export function checkInReminderDue(
  schedule: CheckInScheduleInput,
  now: Date = new Date()
): { kind: "opened" | "closing"; window: CheckInOccurrence } | null {
  const window = getOpenCheckIn(schedule, now);

  if (!window) return null;
  const t = now.getTime();

  if (t - window.opensAt.getTime() < MS_HOUR) return { kind: "opened", window };

  const total = window.closesAt.getTime() - window.opensAt.getTime();
  const lead = Math.min(24 * MS_HOUR, total / 2);
  const remaining = window.closesAt.getTime() - t;

  return remaining <= lead && remaining > lead - MS_HOUR
    ? { kind: "closing", window }
    : null;
}

/** "lun, 17 nov, 12:00" en la zona horaria del propio check-in. */
export function formatCheckInInstant(
  instant: Date | string,
  timezone: string,
  withTime = true
): string {
  return new Date(instant).toLocaleString("es-ES", {
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
    timeZone: timezone,
  });
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

// ─── Vista "cierre + margen" (JC, 23 sep) ───────────────────────────────────
// El trainer piensa en CUÁNDO SE CIERRA el check-in y cuántos días antes se
// abre; en BD sigue guardado como apertura (days_of_week + time) + plazo
// (grace_period_hours). cierre = apertura + plazo, así que es solo un cambio
// de vista: ni validación ni cron ni cálculo de plazos cambian.
// ponytail: se suma en minutos de reloj; un cambio de horario (DST) dentro
// del plazo mueve el cierre real 1h dos veces al año, igual que hoy.

const MINUTES_PER_DAY = 24 * 60;

export interface CheckInCloseView {
  /** Días de la semana (0=domingo) en que se CIERRA cada check-in. */
  closeDays: number[];
  /** Hora local de cierre, "H:MM". */
  closeTime: string;
  /** Cuánto antes del cierre se abre (= grace_period_hours). */
  marginHours: number;
}

function shiftDays(days: number[], by: number): number[] {
  return [...new Set(days.map((d) => (((d + by) % 7) + 7) % 7))].sort(
    (a, b) => a - b
  );
}

function minutesToTime(minutes: number): string {
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`;
}

/** Apertura + plazo guardados → cierre + margen para el editor. */
export function toCloseView(
  schedule: Pick<
    CheckInSchedule,
    "days_of_week" | "time" | "grace_period_hours"
  >
): CheckInCloseView {
  const [h, m] = parseTime(schedule.time);
  const total = h * 60 + m + schedule.grace_period_hours * 60;
  const minuteOfDay =
    ((total % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;

  return {
    closeDays: shiftDays(
      schedule.days_of_week,
      Math.floor(total / MINUTES_PER_DAY)
    ),
    closeTime: minutesToTime(minuteOfDay),
    marginHours: schedule.grace_period_hours,
  };
}

/** Cierre + margen del editor → apertura + plazo a guardar. */
export function fromCloseView(
  view: CheckInCloseView
): Pick<CheckInSchedule, "days_of_week" | "time" | "grace_period_hours"> {
  const [h, m] = parseTime(view.closeTime);
  const total = h * 60 + m - view.marginHours * 60;
  const minuteOfDay =
    ((total % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;

  return {
    days_of_week: shiftDays(
      view.closeDays,
      Math.floor(total / MINUTES_PER_DAY)
    ),
    time: minutesToTime(minuteOfDay),
    grace_period_hours: view.marginHours,
  };
}
