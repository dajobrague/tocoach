// Pure utilities for per-day adherence calculation. No React, no IO.

import type { ExerciseLog } from "../progress/types";
import type {
  DayAdherence,
  DayClassification,
  PrescribedExercise,
} from "./types";

import { logMatchesSlot } from "@/lib/training/log-attribution";

/**
 * Prescripción con el id del slot (`session_exercises.id`) cuando el caller
 * lo conoce. Con él, dos slots del mismo ejercicio de librería (pesado +
 * back-off) cuentan por separado; sin él aplica el fallback por exercise_id.
 */
export type PrescribedSlot = PrescribedExercise & {
  sessionExerciseId?: string;
};

// Returned by reference today, but every consumer must treat as read-only —
// any mutation would silently corrupt every "no prescription" day in the
// week. Frozen to surface the contract loudly.
const EMPTY_ADHERENCE: DayAdherence = Object.freeze({
  totalPrescribed: 0,
  completedExercises: 0,
  prescribedSetsTotal: 0,
  loggedSetsTotal: 0,
  prescribedLoadTotal: 0,
  loggedLoadTotal: 0,
  ejercicios: 0,
  series: 0,
  seriesRaw: 0,
  hasOverage: false,
  carga: 1,
}) as DayAdherence;

/**
 * Convierte la prescripción de reps (TEXT) en un número promedio usable
 * para cálculo de carga prescripta. Soporta:
 *   - "10"        → 10
 *   - "10-12"     → 11 (promedio del rango)
 *   - "12+"       → 12 (lower bound)
 *   - "AMRAP"     → 0  (no contribuye a load total)
 *   - "10/8/6"    → 8  (promedio de la lista — drop sets típicos)
 * Antes solo matcheaba el primer run de dígitos, así que "10-12" → 10
 * (subestima rango) y "10/8/6" → 10 (sobreestima drop set).
 */
function parseReps(reps: string | null | undefined): number {
  if (reps == null) return 0;
  const text = String(reps).trim();

  if (text === "" || /^amrap$/i.test(text)) return 0;
  const matches = text.match(/\d+/g);

  if (!matches || matches.length === 0) return 0;
  const nums = matches.map((m) => parseInt(m, 10)).filter((n) => !isNaN(n));

  if (nums.length === 0) return 0;

  // Range "a-b" → avg. Drop sets "a/b/c" → avg. Single + suffix ("12+") → first.
  const sum = nums.reduce((a, b) => a + b, 0);

  return Math.round(sum / nums.length);
}

/**
 * Asigna cada log a UN solo slot prescrito — nunca compartido, para que dos
 * slots del mismo ejercicio no cuenten el mismo trabajo dos veces:
 *   1. Match exacto por `session_exercise_id` (la regla canónica de
 *      lib/training/log-attribution).
 *   2. Fallback vía logMatchesSlot para prescripciones/logs sin slot id;
 *      cada grupo de logs (mismo slot de origen) lo consume el primer slot
 *      pendiente, así los grupos se reparten en orden entre duplicados.
 * Los logs ya llegan acotados a la sesión por el caller, por eso el
 * sessionId que exige logMatchesSlot se neutraliza con el del propio log.
 */
function attributeLogsToSlots(
  prescribed: readonly PrescribedSlot[],
  logs: readonly ExerciseLog[]
): ExerciseLog[][] {
  const consumed = new Set<ExerciseLog>();
  const bySlot = prescribed.map<ExerciseLog[]>(() => []);

  prescribed.forEach((p, i) => {
    const bucket = bySlot[i];
    const slotId = p.sessionExerciseId;

    if (!bucket || !slotId) return;
    for (const log of logs) {
      if (consumed.has(log)) continue;
      if (log.session_exercise_id === slotId) {
        bucket.push(log);
        consumed.add(log);
      }
    }
  });

  prescribed.forEach((p, i) => {
    const bucket = bySlot[i];

    if (!bucket || bucket.length > 0) return;
    const planned = {
      exercise_id: p.exerciseId,
      ...(p.sessionExerciseId
        ? { session_exercise_id: p.sessionExerciseId }
        : {}),
    };
    const candidates = logs.filter(
      (l) => !consumed.has(l) && logMatchesSlot(l, planned, l.session_id ?? "")
    );
    const first = candidates[0];

    if (!first) return;
    const groupKey = first.session_exercise_id ?? null;

    for (const log of candidates) {
      if ((log.session_exercise_id ?? null) !== groupKey) continue;
      bucket.push(log);
      consumed.add(log);
    }
  });

  return bySlot;
}

export function computeDayAdherence(
  prescribed: PrescribedSlot[],
  logs: ExerciseLog[]
): DayAdherence {
  if (prescribed.length === 0) return EMPTY_ADHERENCE;

  let completedExercises = 0;
  let prescribedSetsTotal = 0;
  let loggedSetsTotal = 0;
  let prescribedLoadTotal = 0;
  let loggedLoadTotal = 0;

  const logsBySlot = attributeLogsToSlots(prescribed, logs);

  prescribed.forEach((p, slotIndex) => {
    const exerciseLogs = logsBySlot[slotIndex] ?? [];
    const loggedSetsForExercise = exerciseLogs.flatMap((l) => l.sets ?? []);

    const prescribedSets = p.prescribedSets ?? 0;
    const prescribedReps = parseReps(p.prescribedReps);
    const prescribedWeight = p.prescribedWeightKg ?? 0;

    // An exercise counts as "completed" only when:
    //   - there is at least one logged set, AND
    //   - if the prescription specifies a set count > 0, the logged set count
    //     reaches it (a single-set log against a 4-set prescription used to
    //     mark the exercise complete and the day "100% ejercicios" with one
    //     trivial set; that's the bug being fixed here).
    if (loggedSetsForExercise.length > 0) {
      if (
        prescribedSets > 0
          ? loggedSetsForExercise.length >= prescribedSets
          : true
      ) {
        completedExercises += 1;
      }
    }
    loggedSetsTotal += loggedSetsForExercise.length;

    prescribedSetsTotal += prescribedSets;

    // Only count load when the prescription has weight > 0; bodyweight
    // exercises shouldn't drag the carga ratio down.
    if (prescribedWeight > 0) {
      prescribedLoadTotal += prescribedSets * prescribedReps * prescribedWeight;

      for (const s of loggedSetsForExercise) {
        loggedLoadTotal += (s.reps ?? 0) * (s.weight_kg ?? 0);
      }
    }
  });

  const ejercicios = completedExercises / prescribed.length;
  // seriesRaw exposes the unclamped ratio so the UI can distinguish "did
  // exactly the prescription" from "did more than prescribed" (e.g. 1.5 =
  // 6 sets done of 4 prescribed). series stays clamped for backwards-
  // compat with consumers that drive a progress bar.
  const seriesRaw =
    prescribedSetsTotal === 0 ? 0 : loggedSetsTotal / prescribedSetsTotal;
  const series = Math.min(seriesRaw, 1);
  const hasOverage = seriesRaw > 1;
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
    seriesRaw,
    hasOverage,
    carga,
  };
}

/**
 * When a session has logs but they don't match the prescription (client did
 * different exercises), compute adherence from the ACTUAL work done. The
 * metrics reflect reality: how many distinct exercises, total sets, total load.
 */
export function computeAdherenceFromLogs(logs: ExerciseLog[]): DayAdherence {
  if (logs.length === 0) return EMPTY_ADHERENCE;

  const byExercise = new Map<string, ExerciseLog[]>();

  for (const log of logs) {
    if (!log.exercise_id) continue;
    const arr = byExercise.get(log.exercise_id) ?? [];

    arr.push(log);
    byExercise.set(log.exercise_id, arr);
  }

  const totalExercises = byExercise.size;
  let loggedSetsTotal = 0;
  let loggedLoadTotal = 0;

  for (const exerciseLogs of byExercise.values()) {
    const sets = exerciseLogs.flatMap((l) => l.sets ?? []);

    loggedSetsTotal += sets.length;

    for (const s of sets) {
      loggedLoadTotal += (s.reps ?? 0) * (s.weight_kg ?? 0);
    }
  }

  return {
    totalPrescribed: totalExercises,
    completedExercises: totalExercises,
    prescribedSetsTotal: loggedSetsTotal,
    loggedSetsTotal,
    prescribedLoadTotal: loggedLoadTotal,
    loggedLoadTotal,
    ejercicios: 1,
    series: 1,
    seriesRaw: 1,
    hasOverage: false,
    carga: 1,
  };
}

export function classifyDay(
  hasPrescribed: boolean,
  adherence: DayAdherence,
  isFuture: boolean,
  statusCompleted = false
): DayClassification {
  if (isFuture) return "future";
  // La fila scheduled_sessions dice "completed" (el cliente lo marcó a mano
  // o cubrió todo): eso manda sobre el conteo de ejercicios. Un cliente que
  // dio la sesión por terminada con ejercicios saltados NO es "parcial".
  if (statusCompleted) return "complete";
  if (adherence.loggedSetsTotal > 0) {
    if (
      adherence.totalPrescribed > 0 &&
      adherence.completedExercises >= adherence.totalPrescribed
    )
      return "complete";

    // Hubo trabajo pero la prescripción no se cubrió entera: "partial"
    // incluso cuando NINGÚN ejercicio llegó a su cantidad de series (el
    // fallthrough anterior marcaba 'complete' un día apenas empezado).
    // Sin prescripción contra la cual comparar, el trabajo cuenta entero.
    return adherence.totalPrescribed === 0 ? "complete" : "partial";
  }
  if (!hasPrescribed) return "rest";

  return "pending";
}

export function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

/**
 * Etiqueta de estado del día para el selector de fechas del trainer. El %
 * dejó de ser el dato principal (una sesión marcada completa con ejercicios
 * saltados diría "33%"): ahora se lee hecho / empezado / sin hacer.
 */
export function classificationLabel(classification: DayClassification): string {
  switch (classification) {
    case "complete":
      return "Hecho";
    case "partial":
      return "Empezado";
    case "pending":
      return "Sin hacer";
    default:
      return "";
  }
}
