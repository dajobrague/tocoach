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
  /** Uniform prescribed weight (Phase 3 override). */
  weightKg?: number | null;
  /** Per-set prescription (Phase 3.5 override). Wins over uniform when present. */
  prescribedSets?: Array<{
    setNumber: number;
    reps: string | null;
    weightKg: number | null;
  }>;
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
  // videoUrl/videoPath quedan undefined: el form los hidrata bajo demanda.
}

// Hidrata el formulario al abrir el modal: existingLog (si hay) > defaults
// derivados del exercise (target del programa). El draft local se aplica
// encima en el orquestador, no aquí.
export function buildBaseFormData(
  exercise: ExerciseShape,
  existingLog: any
): ExerciseLogFormDraft {
  let sets: SetDraft[];

  // Only prefer an existing log over the prescription when the log carries
  // actual data. An autosave taken before the trainer edited the override
  // can land here with all sets at reps:"" weight:"", and was winning over
  // the freshly-updated prescription — leaving the form looking empty.
  // Treat such empty autosaves as "no log yet" and fall through to the
  // prescription. A video on a set still counts as data.
  const hasUsableExistingSets =
    existingLog?.sets &&
    Array.isArray(existingLog.sets) &&
    existingLog.sets.length > 0 &&
    (existingLog.finalized_at != null ||
      existingLog.sets.some(
        (s: any) =>
          (s.reps != null && String(s.reps).trim() !== "") ||
          (s.weight_kg != null && String(s.weight_kg).trim() !== "") ||
          (typeof s.video_url === "string" && s.video_url.length > 0)
      ));

  if (hasUsableExistingSets) {
    sets = existingLog.sets.map((s: any) => ({
      reps: s.reps != null ? String(s.reps) : "",
      weight: s.weight_kg != null ? String(s.weight_kg) : "",
      videoUrl:
        typeof s.video_url === "string" && s.video_url.length > 0
          ? s.video_url
          : undefined,
    }));

    // Compat con logs viejos que tenían un solo video por ejercicio
    // (exercise_logs.video_url). Si el log existente trae video legacy
    // y la primera serie no tiene video propio, mostramos el legacy en
    // la primera serie en modo read-only (lo conserva al guardar
    // mientras no lo cambien).
    if (
      sets.length > 0 &&
      !sets[0]!.videoUrl &&
      typeof existingLog.video_url === "string" &&
      existingLog.video_url.length > 0
    ) {
      sets[0]!.videoUrl = existingLog.video_url;
    }
  } else if (existingLog?.sets_completed) {
    const count = existingLog.sets_completed;
    const repsStr = existingLog.reps_completed;
    let reps = "";

    if (repsStr) {
      const m = String(repsStr).match(/\d+/);

      if (m) reps = m[0];
    }
    sets = Array.from({ length: count }, () => ({ reps, weight: "" }));
  } else if (exercise.prescribedSets && exercise.prescribedSets.length > 0) {
    // Per-set trainer override: prefill each row with its prescribed values.
    sets = exercise.prescribedSets.map((s) => ({
      reps: s.reps != null ? String(s.reps) : "",
      weight: s.weightKg != null ? String(s.weightKg) : "",
    }));
  } else {
    // Uniform prescription: build N empty rows, prefilled with the trainer's
    // uniform reps/weight when present (Phase 3 override).
    const count = exercise.sets || 1;
    const repsStr = exercise.reps != null ? String(exercise.reps) : "";
    const weightStr =
      exercise.weightKg != null ? String(exercise.weightKg) : "";

    sets = Array.from({ length: count }, () => ({
      reps: repsStr,
      weight: weightStr,
    }));
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
