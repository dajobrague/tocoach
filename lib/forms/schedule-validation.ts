import type { SupabaseClient } from "@supabase/supabase-js";
import type { CheckInFrequency, CheckInSchedule } from "./types";

import { getScheduleOrDefault } from "./schedule";

/**
 * Loads `default_schedule` from the client's template row, or the tenant's active check-ins template.
 */
export async function fetchCheckinsTemplateDefaultSchedule(
  supabase: SupabaseClient,
  tenantHost: string,
  templateId?: string | null
): Promise<unknown | null> {
  if (templateId) {
    const { data } = await supabase
      .from("form_templates")
      .select("default_schedule")
      .eq("id", templateId)
      .maybeSingle();

    if (data?.default_schedule != null) {
      return data.default_schedule;
    }
  }

  const { data: fallbackRows, error: fallbackErr } = await supabase
    .from("form_templates")
    .select("default_schedule")
    .eq("tenant_host", tenantHost)
    .eq("form_type", "checkins")
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(1);

  if (fallbackErr) {
    console.warn(
      "[fetchCheckinsTemplateDefaultSchedule] Active template query:",
      fallbackErr
    );
  }

  return fallbackRows?.[0]?.default_schedule ?? null;
}

export type ScheduleSource = "client" | "template" | "default";

/**
 * Effective check-in schedule for API responses (client column → template default → system default).
 */
export function resolveCheckInScheduleForApi(
  clientSchedule: unknown | null | undefined,
  templateDefaultSchedule: unknown | null | undefined
): { schedule: CheckInSchedule; schedule_source: ScheduleSource } {
  if (clientSchedule != null) {
    return {
      schedule: getScheduleOrDefault(clientSchedule as CheckInSchedule),
      schedule_source: "client",
    };
  }

  if (templateDefaultSchedule != null) {
    return {
      schedule: getScheduleOrDefault(
        templateDefaultSchedule as CheckInSchedule
      ),
      schedule_source: "template",
    };
  }

  return {
    schedule: getScheduleOrDefault(null),
    schedule_source: "default",
  };
}

const TIME_RE = /^\d{2}:\d{2}$/;

/** Accepts "9:30" / "09:30" and normalizes to strict HH:MM for DB/API checks. */
export function normalizeWallTimeToHHMM(time: string): string {
  const t = time.trim();
  const m = /^(\d{1,2}):(\d{2})$/.exec(t);

  if (!m) return t;

  const h = Number(m[1]);
  const mm = m[2];

  if (
    !Number.isInteger(h) ||
    h < 0 ||
    h > 23 ||
    mm === undefined ||
    !/^\d{2}$/.test(mm)
  ) {
    return t;
  }

  const mi = Number(mm);

  if (!Number.isInteger(mi) || mi < 0 || mi > 59) {
    return t;
  }

  return `${String(h).padStart(2, "0")}:${mm}`;
}

function isValidIanaTimeZone(tz: string): boolean {
  const t = tz.trim();

  if (!t) return false;

  try {
    Intl.DateTimeFormat("en-US", { timeZone: t }).format(new Date());

    return true;
  } catch {
    return false;
  }
}

/**
 * Validates a check-in schedule payload from the API (Spanish errors).
 */
export function validateCheckInScheduleInput(
  input: unknown
): { ok: true; value: CheckInSchedule } | { ok: false; errors: string[] } {
  const errors: string[] = [];

  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, errors: ["El horario debe ser un objeto."] };
  }

  const o = input as Record<string, unknown>;

  const frequency = o.frequency;

  if (
    frequency !== "weekly" &&
    frequency !== "biweekly" &&
    frequency !== "custom"
  ) {
    errors.push('La frecuencia debe ser "weekly", "biweekly" o "custom".');
  }

  const days = o.days_of_week;

  let daysOfWeekUnique: number[] = [];

  if (!Array.isArray(days) || days.length === 0) {
    errors.push(
      "days_of_week debe ser un array no vacío con números del 0 (domingo) al 6 (sábado)."
    );
  } else {
    for (const d of days) {
      if (typeof d !== "number" || !Number.isInteger(d) || d < 0 || d > 6) {
        errors.push("Cada día en days_of_week debe ser un entero entre 0 y 6.");
        break;
      }
    }

    if (errors.length === 0) {
      daysOfWeekUnique = [
        ...new Set(
          (days as number[]).filter(
            (d) => Number.isInteger(d) && d >= 0 && d <= 6
          )
        ),
      ].sort((a, b) => a - b);

      if (daysOfWeekUnique.length === 0) {
        errors.push(
          "days_of_week debe ser un array no vacío con números del 0 (domingo) al 6 (sábado)."
        );
      }
    }
  }

  const timeRaw = typeof o.time === "string" ? o.time.trim() : "";
  const timeNormalized = timeRaw ? normalizeWallTimeToHHMM(timeRaw) : "";

  if (!timeRaw || !TIME_RE.test(timeNormalized)) {
    errors.push(
      'El campo time debe tener el formato HH:MM (24 h), por ejemplo "09:00".'
    );
  }

  const timezone = o.timezone;

  if (typeof timezone !== "string" || !isValidIanaTimeZone(timezone)) {
    errors.push(
      "La zona horaria debe ser un identificador IANA válido (por ejemplo, Europe/Madrid)."
    );
  }

  const customName = o.custom_name;

  if (typeof customName !== "string" || customName.trim().length === 0) {
    errors.push("custom_name es obligatorio y no puede estar vacío.");
  } else if (customName.trim().length > 50) {
    errors.push("custom_name no puede superar 50 caracteres.");
  }

  const grace = o.grace_period_hours;

  if (
    typeof grace !== "number" ||
    !Number.isFinite(grace) ||
    !Number.isInteger(grace) ||
    grace < 12 ||
    grace > 168
  ) {
    errors.push(
      "grace_period_hours debe ser un entero entre 12 y 168 (12 horas a 7 días)."
    );
  }

  const timesPerWeek = o.times_per_week;

  if (
    typeof timesPerWeek !== "number" ||
    !Number.isFinite(timesPerWeek) ||
    !Number.isInteger(timesPerWeek) ||
    timesPerWeek < 1
  ) {
    errors.push("times_per_week debe ser un entero mayor o igual que 1.");
  }
  // custom: times_per_week is coerced to match days_of_week.length on success (below)

  let enabled = true;

  if (o.enabled !== undefined && o.enabled !== null) {
    if (typeof o.enabled !== "boolean") {
      errors.push("enabled debe ser true o false.");
    } else {
      enabled = o.enabled;
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const freq = frequency as CheckInFrequency;

  const resolvedTimesPerWeek =
    freq === "custom" && daysOfWeekUnique.length > 0
      ? daysOfWeekUnique.length
      : (timesPerWeek as number);

  const value: CheckInSchedule = {
    frequency: freq,
    times_per_week: resolvedTimesPerWeek,
    days_of_week: daysOfWeekUnique,
    time: timeNormalized,
    timezone: (timezone as string).trim(),
    custom_name: (customName as string).trim(),
    grace_period_hours: grace as number,
    enabled,
  };

  return { ok: true, value };
}
