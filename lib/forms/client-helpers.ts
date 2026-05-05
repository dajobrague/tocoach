// Client-side form helpers for status checking and timezone handling

/**
 * Devuelve la fecha de hoy en el huso horario del navegador (YYYY-MM-DD).
 *
 * Antes usábamos `new Date().toISOString().split("T")[0]`, que devuelve la
 * fecha en UTC. Para un cliente en Argentina (UTC-3) que registra hábitos a
 * las 22h local, el ISO UTC ya era el día siguiente (01:00 UTC), por lo que
 * el registro quedaba guardado con la fecha de "mañana" y los filtros de
 * "buscar registro de hoy" no matcheaban.
 *
 * Esta función usa los componentes Date del huso local del navegador, por
 * lo que `response_date` = la fecha que el usuario ve en su reloj.
 *
 * IMPORTANTE: sólo es válido en el browser. En el servidor (Node), los
 * componentes Date están en el huso del proceso y no tienen relación con el
 * huso del cliente — por eso este helper vive en `client-helpers.ts`.
 */
export function getLocalTodayYmd(date: Date = new Date()): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");

  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Same as {@link getLocalTodayYmd} but with a name that signals intent when
 * used for an arbitrary date (not "today"). Prefer this when migrating away
 * from `someDate.toISOString().split("T")[0]` — using `toISOString()` for a
 * locally-computed Date silently shifts the day across the UTC boundary
 * (e.g. España UTC+2 a la 1am local muestra "ayer" en UTC; Argentina UTC-3
 * a las 22h local muestra "mañana" en UTC). This helper formats with the
 * browser's local components so the YYYY-MM-DD matches what the user sees
 * on their clock — which is what `response_date`, calendar cells, and any
 * UI key tied to "the day the user is in" actually need.
 *
 * Browser-only — see the caveat on {@link getLocalTodayYmd}.
 */
export function getLocalYmd(date: Date): string {
  return getLocalTodayYmd(date);
}

import {
  DEFAULT_CHECKIN_SCHEDULE,
  getCheckInPeriodEnd,
  getCheckInPeriodStart,
  getCheckInStatus,
  getEffectiveSubmissionDeadline,
  isCheckInDue,
} from "./schedule";
import { FormResponse, FormType } from "./types";

/** Maps stored responses to the shape expected by {@link isCheckInDue} / {@link getCheckInStatus}. */
export function formResponsesToSubmittedAtPayload(responses: FormResponse[]): {
  submitted_at: string;
}[] {
  return responses.map((r) => ({
    submitted_at:
      typeof r.submitted_at === "string" && r.submitted_at.trim().length > 0
        ? r.submitted_at
        : `${r.response_date}T12:00:00.000Z`,
  }));
}

/**
 * @deprecated Use {@link getCheckInPeriodStart} from `./schedule` with the client’s
 * {@link import("./types").CheckInSchedule}. This wrapper uses {@link DEFAULT_CHECKIN_SCHEDULE}
 * (Europe/Madrid, Monday 12:00) and may differ from the old browser-local Monday 00:00 week.
 *
 * @example
 * ```ts
 * // Prefer:
 * getCheckInPeriodStart(clientSchedule, new Date());
 * ```
 */
export function getWeekStartDate(date: Date = new Date()): Date {
  return getCheckInPeriodStart(DEFAULT_CHECKIN_SCHEDULE, date);
}

/**
 * @deprecated Use {@link getCheckInPeriodEnd} from `./schedule` with a real schedule.
 * Delegates to {@link DEFAULT_CHECKIN_SCHEDULE}.
 *
 * @example
 * ```ts
 * const start = getCheckInPeriodStart(schedule, new Date());
 * const end = getCheckInPeriodEnd(schedule, start);
 * ```
 */
export function getWeekEndDate(date: Date = new Date()): Date {
  const periodStart = getCheckInPeriodStart(DEFAULT_CHECKIN_SCHEDULE, date);

  return getCheckInPeriodEnd(DEFAULT_CHECKIN_SCHEDULE, periodStart);
}

/**
 * @deprecated Use {@link isCheckInDue} from `./schedule` with the client’s real schedule.
 * This helper always uses the **system** {@link DEFAULT_CHECKIN_SCHEDULE}
 * ({@link import("./types").DEFAULT_CHECKIN_SCHEDULE} — Monday 12:00, Europe/Madrid), not per-client config.
 */
export function isWeeklyCheckInDue(responses: FormResponse[]): boolean {
  return isCheckInDue(
    DEFAULT_CHECKIN_SCHEDULE,
    formResponsesToSubmittedAtPayload(responses),
    new Date()
  );
}

/**
 * Check if daily habits was submitted today
 */
export function isDailyHabitsSubmittedToday(
  responses: FormResponse[]
): boolean {
  // Fecha local del navegador, no UTC. Sin esto, el check pregunta por el
  // día de mañana para usuarios en zonas al oeste de UTC y responde
  // `false` aunque el usuario ya haya enviado su registro hoy.
  const today = getLocalTodayYmd();

  return responses.some((r) => r.response_date === today);
}

/**
 * @deprecated For check-ins, use {@link getCheckInStatus} from `./schedule` with responses.
 * This implementation treats “expired” as {@link getCheckInStatus} === `"expired"` with
 * {@link DEFAULT_CHECKIN_SCHEDULE} and no responses supplied for the status check.
 */
export function isFormExpired(
  formType: FormType,
  _submissionDate?: string
): boolean {
  const now = new Date();

  if (formType === "checkins") {
    return getCheckInStatus(DEFAULT_CHECKIN_SCHEDULE, [], now) === "expired";
  } else {
    // Daily habits expires at end of day (no grace period for simplicity)
    const todayEnd = new Date(now);

    todayEnd.setHours(23, 59, 59, 999);

    return now > todayEnd;
  }
}

/** @returns Whether `date` is Monday in the browser’s local calendar. */
export function isMonday(date: Date = new Date()): boolean {
  return date.getDay() === 1;
}

/**
 * Check if weekly form should be displayed
 * Shows ONLY on Monday or Tuesday (grace period), and only if not submitted
 */
export function shouldShowWeeklyCheckIn(responses: FormResponse[]): boolean {
  // Simply check if it's due (which now includes Monday/Tuesday check)
  return isWeeklyCheckInDue(responses);
}

/**
 * @deprecated Use {@link getCheckInDeadline} from `./schedule` with
 * `getCheckInPeriodStart(schedule, now)` for check-ins.
 */
export function getDeadlineForForm(
  formType: FormType,
  _clientTimezone: string = "America/Chicago"
): Date {
  const now = new Date();

  if (formType === "checkins") {
    return getEffectiveSubmissionDeadline(DEFAULT_CHECKIN_SCHEDULE, now);
  } else {
    // Daily: Today 23:59
    const todayEnd = new Date(now);

    todayEnd.setHours(23, 59, 59, 999);

    return todayEnd;
  }
}

/**
 * Format deadline in a human-readable way
 */
export function formatDeadline(formType: FormType): string {
  const deadline = getDeadlineForForm(formType);
  const now = new Date();
  const diffMs = deadline.getTime() - now.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffHours < 24) {
    return `Expira en ${diffHours} horas`;
  } else {
    const diffDays = Math.floor(diffHours / 24);

    return `Expira en ${diffDays} días`;
  }
}

/**
 * @deprecated Use {@link getCheckInStatus} from `./schedule` with the client’s schedule for check-ins.
 * Check-ins use **only** {@link DEFAULT_CHECKIN_SCHEDULE} (system default), not per-client DB config.
 * Maps `"disabled"` to `"not_due"` so the return type stays unchanged for legacy callers.
 */
export function getFormStatus(
  formType: FormType,
  responses: FormResponse[]
): "pending" | "completed" | "expired" | "not_due" {
  if (formType === "checkins") {
    const status = getCheckInStatus(
      DEFAULT_CHECKIN_SCHEDULE,
      formResponsesToSubmittedAtPayload(responses),
      new Date()
    );

    if (status === "disabled") return "not_due";

    return status;
  } else {
    const isSubmittedToday = isDailyHabitsSubmittedToday(responses);

    if (isSubmittedToday) return "completed";

    return "pending";
  }
}
