import type { ExerciseLog } from "../progress/types";
import type { DayMetrics } from "./types";

/** Volumen (kg·reps) de unos logs: Σ reps × kg de sus series. */
export function logsVolume(logs: ExerciseLog[]): number {
  return Math.round(
    logs
      .flatMap((log) => log.sets ?? [])
      .reduce((acc, set) => acc + (set.reps ?? 0) * (set.weight_kg ?? 0), 0)
  );
}

/**
 * Volumen de la semana: todas las sesiones de los 7 días. Un log se cuenta
 * una sola vez aunque aparezca en más de una sesión del día.
 */
export function weekVolume(days: DayMetrics[]): number {
  const byId = new Map<string, ExerciseLog>();

  for (const day of days) {
    for (const entry of day.sessions) {
      for (const log of entry.logs) byId.set(log.id, log);
    }
  }

  return logsVolume([...byId.values()]);
}
