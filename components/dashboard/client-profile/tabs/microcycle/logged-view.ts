// Pure helpers for the trainer day-detail "actuals-first" view. No React, no IO.
//
// When a client logs a session the trainer view shows what was ACTUALLY done
// (mirroring the client app, which appends off-template logged exercises),
// instead of rendering the prescription and silently hiding the off-plan work.
// An exercise is "off-plan" when the client logged it but it isn't in the
// session's prescription for that day.

import type { ExerciseLog } from "../progress/types";
import type { PrescribedExercise } from "./types";

export interface LoggedExerciseGroup {
  exerciseId: string;
  name: string;
  logs: ExerciseLog[];
  /** True when the client logged this exercise but it wasn't prescribed. */
  offPlan: boolean;
}

/**
 * Group every exercise the client logged for a session, in the order they were
 * first logged, tagging each as off-plan when it isn't part of the prescription.
 * Off-plan exercises are kept (not hidden) so the trainer sees what was done.
 */
export function buildLoggedExerciseGroups(
  prescribed: PrescribedExercise[],
  logs: ExerciseLog[]
): LoggedExerciseGroup[] {
  const prescribedIds = new Set(prescribed.map((p) => p.exerciseId));
  const byId = new Map<string, LoggedExerciseGroup>();

  for (const log of logs) {
    const id = log.exercise_id ?? "unknown";
    const existing = byId.get(id);

    if (existing) {
      existing.logs.push(log);
      continue;
    }

    byId.set(id, {
      exerciseId: id,
      name: log.exercises?.name ?? "Ejercicio",
      logs: [log],
      offPlan: !prescribedIds.has(id),
    });
  }

  return Array.from(byId.values());
}

/** Total number of logged sets across all logs (off-plan included). */
export function countLoggedSets(logs: ExerciseLog[]): number {
  return logs.reduce((acc, log) => acc + (log.sets?.length ?? 0), 0);
}
