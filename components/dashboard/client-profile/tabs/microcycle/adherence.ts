// Pure utilities for per-day adherence calculation. No React, no IO.

import type { ExerciseLog } from "../progress/types";
import type {
  DayAdherence,
  DayClassification,
  PrescribedExercise,
} from "./types";

const EMPTY_ADHERENCE: DayAdherence = {
  totalPrescribed: 0,
  completedExercises: 0,
  prescribedSetsTotal: 0,
  loggedSetsTotal: 0,
  prescribedLoadTotal: 0,
  loggedLoadTotal: 0,
  ejercicios: 0,
  series: 0,
  carga: 1,
};

function parseReps(reps: string | null | undefined): number {
  if (reps == null) return 0;
  const match = String(reps).match(/\d+/);

  return match ? parseInt(match[0]) : 0;
}

export function computeDayAdherence(
  prescribed: PrescribedExercise[],
  logs: ExerciseLog[]
): DayAdherence {
  if (prescribed.length === 0) return EMPTY_ADHERENCE;

  let completedExercises = 0;
  let prescribedSetsTotal = 0;
  let loggedSetsTotal = 0;
  let prescribedLoadTotal = 0;
  let loggedLoadTotal = 0;

  for (const p of prescribed) {
    const exerciseLogs = logs.filter((l) => l.exercise_id === p.exerciseId);
    const loggedSetsForExercise = exerciseLogs.flatMap((l) => l.sets ?? []);

    if (loggedSetsForExercise.length > 0) completedExercises += 1;
    loggedSetsTotal += loggedSetsForExercise.length;

    const prescribedSets = p.prescribedSets ?? 0;
    const prescribedReps = parseReps(p.prescribedReps);
    const prescribedWeight = p.prescribedWeightKg ?? 0;

    prescribedSetsTotal += prescribedSets;

    // Only count load when the prescription has weight > 0; bodyweight
    // exercises shouldn't drag the carga ratio down.
    if (prescribedWeight > 0) {
      prescribedLoadTotal += prescribedSets * prescribedReps * prescribedWeight;

      for (const s of loggedSetsForExercise) {
        loggedLoadTotal += (s.reps ?? 0) * (s.weight_kg ?? 0);
      }
    }
  }

  const ejercicios = completedExercises / prescribed.length;
  const series =
    prescribedSetsTotal === 0
      ? 0
      : Math.min(loggedSetsTotal / prescribedSetsTotal, 1);
  const carga =
    prescribedLoadTotal === 0
      ? 1
      : Math.min(loggedLoadTotal / prescribedLoadTotal, 1);

  return {
    totalPrescribed: prescribed.length,
    completedExercises,
    prescribedSetsTotal,
    loggedSetsTotal,
    prescribedLoadTotal,
    loggedLoadTotal,
    ejercicios,
    series,
    carga,
  };
}

export function classifyDay(
  hasPrescribed: boolean,
  adherence: DayAdherence,
  isFuture: boolean
): DayClassification {
  if (!hasPrescribed) return "rest";
  if (isFuture) return "future";
  if (adherence.completedExercises === 0) return "pending";
  if (adherence.completedExercises === adherence.totalPrescribed)
    return "complete";

  return "partial";
}

export function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}
