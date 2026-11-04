// Días que el cliente puede rellenar el Registro diario (incluido hoy).
// JC: cada entrenador decide el margen. Vive en tenants.features.habit_log_days.

export const HABIT_LOG_DAYS_DEFAULT = 3;
export const HABIT_LOG_DAYS_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 10, 14] as const;

export function parseHabitLogDays(value: unknown): number | null {
  return typeof value === "number" &&
    (HABIT_LOG_DAYS_OPTIONS as readonly number[]).includes(value)
    ? value
    : null;
}

export function habitLogDaysFromFeatures(features: unknown): number {
  const raw =
    features !== null && typeof features === "object"
      ? (features as Record<string, unknown>).habit_log_days
      : undefined;

  return parseHabitLogDays(raw) ?? HABIT_LOG_DAYS_DEFAULT;
}
