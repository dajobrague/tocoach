// Cálculo puro de las cifras de Inicio del entrenador (sin I/O), para poder
// probarlo. Las fechas de calendario son "YYYY-MM-DD"; la semana va de lunes
// a domingo en la zona de la app (Europe/Madrid).

import type { CheckInSchedule } from "@/lib/forms/types";

import { getUpcomingCheckIns } from "@/lib/forms/schedule";

export const APP_TIMEZONE = "Europe/Madrid";
const DAY_MS = 24 * 60 * 60 * 1000;

/** "YYYY-MM-DD" de un instante en la zona de la app. */
export function ymdInAppZone(instant: Date): string {
  // en-CA formatea como YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

const toUtc = (ymd: string) => {
  const [y, m, d] = ymd.split("-").map(Number);

  return Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1);
};

export function addDays(ymd: string, days: number): string {
  return new Date(toUtc(ymd) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Lunes de la semana a la que pertenece `ymd`. */
export function mondayOf(ymd: string): string {
  const dow = new Date(toUtc(ymd)).getUTCDay(); // 0 = domingo

  return addDays(ymd, -((dow + 6) % 7));
}

export interface WeekCount {
  due: number;
  received: number;
}

/**
 * Check-ins que tocaban y que llegaron en cada una de las últimas `weeks`
 * semanas (la última es la actual). Un check-in pertenece a la semana en la
 * que CIERRA. Cuenta como recibido si hay una respuesta desde que abrió hasta
 * que abre el siguiente (una respuesta tardía también vale).
 *
 * Usa el horario de HOY para todo el periodo: si el entrenador lo cambió hace
 * poco, las semanas anteriores son una aproximación.
 */
export function weeklyCheckIns(
  schedule: CheckInSchedule,
  responses: readonly { submitted_at: string }[],
  now: Date,
  weeks: number,
  /** Alta del cliente: lo que abrió antes no le tocaba. */
  signUpMs = 0
): WeekCount[] {
  const out: WeekCount[] = Array.from({ length: weeks }, () => ({
    due: 0,
    received: 0,
  }));
  const thisMonday = mondayOf(ymdInAppZone(now));
  const firstMonday = addDays(thisMonday, -7 * (weeks - 1));
  // Empieza dos semanas antes para cazar ventanas que abren antes y cierran dentro.
  const from = new Date(toUtc(firstMonday) - 14 * DAY_MS);
  const windows = getUpcomingCheckIns(schedule, weeks * 7 + 21, from);
  const sent = responses
    .map((r) => new Date(r.submitted_at).getTime())
    .filter((t) => !Number.isNaN(t));

  windows.forEach((w, i) => {
    const week = Math.floor(
      (toUtc(mondayOf(ymdInAppZone(w.closesAt))) - toUtc(firstMonday)) /
        (7 * DAY_MS)
    );
    const slot = out[week];

    if (week < 0 || !slot || w.opensAt.getTime() < signUpMs) return;
    const opens = w.opensAt.getTime();
    const until = windows[i + 1]?.opensAt.getTime() ?? Infinity;

    slot.due += 1;
    if (sent.some((t) => t >= opens && t < until)) slot.received += 1;
  });

  return out;
}

export interface DayCount {
  done: number;
  planned: number;
}

/** Sesiones previstas y hechas por día, de lunes a domingo. */
export function sessionsByDay(
  rows: readonly { scheduled_date: string; status: string }[],
  monday: string
): DayCount[] {
  const days: DayCount[] = Array.from({ length: 7 }, () => ({
    done: 0,
    planned: 0,
  }));

  for (const row of rows) {
    const index = Math.round(
      (toUtc(row.scheduled_date.slice(0, 10)) - toUtc(monday)) / DAY_MS
    );
    const day = days[index];

    if (!day) continue;
    day.planned += 1;
    if (row.status === "completed") day.done += 1;
  }

  return days;
}

/** % hecho sobre lo previsto; null si no había nada previsto. */
export const pct = (done: number, planned: number): number | null =>
  planned > 0 ? Math.round((done / planned) * 100) : null;

/**
 * De los clientes activos HOY, cuántos estaban ya dados de alta al cierre de
 * cada una de las últimas `weeks` semanas. No hay histórico de bajas, así que
 * esto es cómo se formó la cartera actual, no cuántos activos había entonces.
 */
export function rosterGrowth(
  signUpDates: readonly (string | null)[],
  thisMonday: string,
  weeks: number
): number[] {
  return Array.from({ length: weeks }, (_, i) => {
    const sunday = addDays(thisMonday, -7 * (weeks - 1 - i) + 6);

    return signUpDates.filter((d) => !d || d.slice(0, 10) <= sunday).length;
  });
}
