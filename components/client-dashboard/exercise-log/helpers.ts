// Helpers compartidos del módulo exercise-log: detección de cardio,
// construcción del estado inicial del formulario y default set vacío.
// Sin dependencias de React — pueden testearse aisladamente.

import type {
  ExerciseLogFormDraft,
  SetDraft,
} from "@/lib/client/exercise-log-draft";

export interface ExerciseShape {
  id: string;
  name: string;
  category?: string;
  sets?: number;
  reps?: string;
  tempo?: string;
  rest?: string;
  trainingSystem?: string;
  duration?: number;
  distance?: number;
  intensity?: string;
  heartRateZone?: { min: number; max: number };
  cardioType?: string;
}

export function isExerciseCardio(exercise: ExerciseShape): boolean {
  return (
    exercise.category === "cardio" ||
    !!(exercise.duration || exercise.distance || exercise.cardioType)
  );
}

export function defaultSet(): SetDraft {
  return { reps: "", weight: "" };
}

// Hidrata el formulario al abrir el modal: existingLog (si hay) > defaults
// derivados del exercise (target del programa). El draft local se aplica
// encima en el orquestador, no aquí.
export function buildBaseFormData(
  exercise: ExerciseShape,
  existingLog: any
): ExerciseLogFormDraft {
  let sets: SetDraft[];

  if (
    existingLog?.sets &&
    Array.isArray(existingLog.sets) &&
    existingLog.sets.length > 0
  ) {
    sets = existingLog.sets.map((s: any) => ({
      reps: s.reps != null ? String(s.reps) : "",
      weight: s.weight_kg != null ? String(s.weight_kg) : "",
    }));
  } else if (existingLog?.sets_completed) {
    const count = existingLog.sets_completed;
    const repsStr = existingLog.reps_completed;
    let reps = "";

    if (repsStr) {
      const m = String(repsStr).match(/\d+/);

      if (m) reps = m[0];
    }
    sets = Array.from({ length: count }, () => ({ reps, weight: "" }));
  } else {
    const count = exercise.sets || 1;

    sets = Array.from({ length: count }, () => defaultSet());
  }

  return {
    sets,
    durationCompleted: existingLog
      ? existingLog.duration_minutes?.toString() ||
        exercise.duration?.toString() ||
        ""
      : exercise.duration?.toString() || "",
    distanceCompleted: existingLog
      ? existingLog.distance_km?.toString() ||
        exercise.distance?.toString() ||
        ""
      : exercise.distance?.toString() || "",
    intensityCompleted: existingLog
      ? existingLog.intensity || exercise.intensity || ""
      : exercise.intensity || "",
    avgHeartRate: existingLog?.avg_heart_rate?.toString() || "",
    notes: existingLog?.notes || "",
  };
}
