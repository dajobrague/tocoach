// Client-side form helpers for status checking and timezone handling.
//
// Las funciones deprecated (getWeekStartDate, getWeekEndDate,
// isWeeklyCheckInDue, isFormExpired, shouldShowWeeklyCheckIn,
// getDeadlineForForm, formatDeadline, getFormStatus,
// isDailyHabitsSubmittedToday, isMonday) se retiraron 2026-05-12 tras
// confirmar cero consumers en el codebase. Los callers que necesitan
// schedule semantics deben usar `./schedule` directamente con el
// schedule per-tenant (no DEFAULT_CHECKIN_SCHEDULE hardcoded).

import { FormResponse } from "./types";

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

/** Maps stored responses to the shape expected by `isCheckInDue` / `getCheckInStatus`. */
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
