// Datos de "Compartir" (llamada JC, 14 oct): el cliente compone su imagen
// estilo Strava (sesión completa o un ejercicio) y la dibuja su propio
// móvil. El servidor solo entrega estos datos; todo lo de aquí es puro para
// que lo usen la ruta, la hoja del cliente y la vista previa del entrenador.

import {
  type SessionSets,
  type SetInput,
  computeRepMaxes,
  diffRecords,
  estimateOneRepMax,
} from "@/lib/training/e1rm";
import { type MuscleId, parseMuscles } from "@/lib/training/muscles";

export interface ShareSet {
  reps: number;
  weightKg: number;
}

export interface ShareExercise {
  /** exercise_logs.id: un ejercicio puede repetirse en la sesión. */
  id: string;
  exerciseId: string;
  name: string;
  primary: MuscleId[];
  secondary: MuscleId[];
  sets: ShareSet[];
  /** Serie que batió el récord del ejercicio (vs días anteriores). */
  recordIndex: number | null;
  cardioMinutes: number;
  cardioKm: number;
  /** Primer vídeo que el cliente grabó de una serie, si hay. */
  videoUrl: string | null;
}

export interface ShareBranding {
  name: string;
  instagram: string;
  brandColor: string | null;
  /** PNG en data URI (se puede pintar en canvas sin CORS). */
  logoSrc: string | null;
  showTopcoach: boolean;
  /** Texto del pie; "" = "topcoach.io". */
  footer?: string;
}

export interface ShareSession {
  sessionName: string;
  date: string;
  sessionNumber: number | null;
  /** "HH:MM" local en que pulsó "Empezar entrenamiento". */
  startTime: string | null;
  completedAt: string | null;
  exercises: ShareExercise[];
}

export interface SharePayload {
  branding: ShareBranding;
  session: ShareSession;
}

// ---------------------------------------------------------------------------
// Servidor: logs → ejercicios

export interface ShareLogInput {
  id: string;
  exerciseId: string;
  name: string;
  primaryMuscles: unknown;
  secondaryMuscles: unknown;
  sets: SetInput[];
  videoUrls: (string | null)[];
  durationSeconds: number | null;
  distanceMeters: number | null;
}

const positive = (value: number | null | undefined): number =>
  typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;

export function buildShareExercises(
  logs: ShareLogInput[],
  /** Sesiones previas (fecha < la de hoy) por exercise_id. */
  priorByExercise: Map<string, SessionSets[]>
): ShareExercise[] {
  return logs.map((log) => {
    const sets = log.sets
      .map((set) => ({
        reps: positive(set.reps),
        weightKg: positive(set.weight_kg),
      }))
      // Fila sin reps ni peso (cardio, serie vacía): no es una serie.
      .filter((set) => set.reps > 0 || set.weightKg > 0);
    const muscles = parseMuscles(log.primaryMuscles, log.secondaryMuscles);

    return {
      id: log.id,
      exerciseId: log.exerciseId,
      name: log.name,
      primary: muscles?.ok ? muscles.muscles.primary : [],
      secondary: muscles?.ok ? muscles.muscles.secondary : [],
      sets,
      recordIndex: recordIndexOf(
        sets,
        priorByExercise.get(log.exerciseId) ?? []
      ),
      cardioMinutes: Math.round(positive(log.durationSeconds) / 60),
      cardioKm: Math.round(positive(log.distanceMeters) / 100) / 10,
      videoUrl:
        log.videoUrls.find((url) => url && /^https:\/\//.test(url)) ?? null,
    };
  });
}

/** Mismo criterio que el confeti de "¡Nuevo récord!": sin historial, nada. */
function recordIndexOf(sets: ShareSet[], prior: SessionSets[]): number | null {
  const repMaxes = computeRepMaxes(prior);

  if (repMaxes.length === 0) return null;

  const records =
    diffRecords(
      repMaxes,
      sets.map((set) => ({ reps: set.reps, weight_kg: set.weightKg }))
    ) ?? [];
  let best: { reps: number; weightKg: number; e1rm: number } | null = null;

  for (const record of records) {
    const e1rm = estimateOneRepMax(record.weightKg, record.reps) ?? 0;

    if (best === null || e1rm > best.e1rm) best = { ...record, e1rm };
  }
  if (best === null) return null;
  const { reps, weightKg } = best;
  const index = sets.findIndex(
    (set) => set.reps === reps && set.weightKg === weightKg
  );

  return index >= 0 ? index : null;
}

// ---------------------------------------------------------------------------
// Cliente: lo que pintan las plantillas

const nf = new Intl.NumberFormat("es-ES");

export const formatKg = (kg: number) => `${nf.format(Math.round(kg))} kg`;

export const setText = (set: ShareSet) =>
  set.weightKg > 0
    ? `${nf.format(set.weightKg)} kg × ${set.reps}`
    : `${set.reps} reps`;

export const formatMinutes = (minutes: number) =>
  minutes >= 60
    ? `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`
    : `${minutes} min`;

const score = (set: ShareSet) =>
  set.weightKg > 0
    ? (estimateOneRepMax(set.weightKg, set.reps) ?? 0)
    : set.reps / 1000;

/** La serie del récord si la hay; si no, la de mayor 1RM estimado. */
export function heroSet(exercise: ShareExercise): ShareSet | null {
  if (exercise.recordIndex !== null) {
    return exercise.sets[exercise.recordIndex] ?? null;
  }

  return exercise.sets.reduce<ShareSet | null>(
    (best, set) => (best === null || score(set) > score(best) ? set : best),
    null
  );
}

export const exerciseVolume = (exercise: ShareExercise) =>
  exercise.sets.reduce((sum, set) => sum + set.reps * set.weightKg, 0);

export const isCardioOnly = (exercise: ShareExercise) =>
  exercise.sets.length === 0 && exercise.cardioMinutes > 0;

/**
 * Minutos entre "Empezar entrenamiento" y el cierre de la sesión, en hora
 * local. Null si falta algo o sale un valor absurdo (se olvidó cerrar).
 */
export function durationMinutes(session: ShareSession): number | null {
  if (!session.startTime || !session.completedAt) return null;
  const [h, m] = session.startTime.split(":").map(Number);
  const [y, mo, d] = session.date.split("-").map(Number);

  if ([h, m, y, mo, d].some((n) => n === undefined || Number.isNaN(n))) {
    return null;
  }
  const start = new Date(y!, mo! - 1, d!, h!, m!).getTime();
  const minutes = Math.round(
    (new Date(session.completedAt).getTime() - start) / 60_000
  );

  return minutes >= 5 && minutes <= 300 ? minutes : null;
}

export interface Stat {
  label: string;
  value: string;
}

export interface StatDef<T> {
  label: string;
  value: (input: T) => string | null;
}

export const SESSION_STATS = {
  duration: {
    label: "Duración",
    value: (s: ShareSession) => {
      const minutes = durationMinutes(s);

      return minutes === null ? null : formatMinutes(minutes);
    },
  },
  volume: {
    label: "Volumen",
    value: (s: ShareSession) => {
      const kg = s.exercises.reduce((sum, e) => sum + exerciseVolume(e), 0);

      return kg > 0 ? formatKg(kg) : null;
    },
  },
  sets: {
    label: "Series",
    value: (s: ShareSession) => {
      const n = s.exercises.reduce((sum, e) => sum + e.sets.length, 0);

      return n > 0 ? String(n) : null;
    },
  },
  reps: {
    label: "Repeticiones",
    value: (s: ShareSession) => {
      const n = s.exercises.reduce(
        (sum, e) => sum + e.sets.reduce((a, set) => a + set.reps, 0),
        0
      );

      return n > 0 ? nf.format(n) : null;
    },
  },
  exercises: {
    label: "Ejercicios",
    value: (s: ShareSession) =>
      s.exercises.length > 0 ? String(s.exercises.length) : null,
  },
  cardio: {
    label: "Cardio",
    value: (s: ShareSession) => {
      const minutes = s.exercises.reduce((sum, e) => sum + e.cardioMinutes, 0);

      return minutes > 0 ? formatMinutes(minutes) : null;
    },
  },
  records: {
    label: "Récords",
    value: (s: ShareSession) => {
      const n = s.exercises.filter((e) => e.recordIndex !== null).length;

      return n > 0 ? String(n) : null;
    },
  },
  number: {
    label: "Sesión",
    value: (s: ShareSession) =>
      s.sessionNumber ? `Nº ${s.sessionNumber}` : null,
  },
} satisfies Record<string, StatDef<ShareSession>>;

export const EXERCISE_STATS = {
  best: {
    label: "Mejor serie",
    value: (e: ShareExercise) => {
      const set = heroSet(e);

      return set ? setText(set) : null;
    },
  },
  sets: {
    label: "Series",
    value: (e: ShareExercise) =>
      e.sets.length > 0 ? String(e.sets.length) : null,
  },
  volume: {
    label: "Volumen",
    value: (e: ShareExercise) => {
      const kg = exerciseVolume(e);

      return kg > 0 ? formatKg(kg) : null;
    },
  },
  reps: {
    label: "Repeticiones",
    value: (e: ShareExercise) => {
      const n = e.sets.reduce((sum, set) => sum + set.reps, 0);

      return n > 0 ? String(n) : null;
    },
  },
  e1rm: {
    label: "1RM estimado",
    value: (e: ShareExercise) => {
      const set = heroSet(e);
      const e1rm = set ? estimateOneRepMax(set.weightKg, set.reps) : null;

      return e1rm ? formatKg(e1rm) : null;
    },
  },
  cardio: {
    label: "Tiempo",
    value: (e: ShareExercise) =>
      e.cardioMinutes > 0 ? formatMinutes(e.cardioMinutes) : null,
  },
  distance: {
    label: "Distancia",
    value: (e: ShareExercise) =>
      e.cardioKm > 0 ? `${nf.format(e.cardioKm)} km` : null,
  },
} satisfies Record<string, StatDef<ShareExercise>>;

export type SessionStatKey = keyof typeof SESSION_STATS;
export type ExerciseStatKey = keyof typeof EXERCISE_STATS;

export const MAX_STATS = 3;

/** Claves con valor para este input, en el orden de la tabla. */
export function availableStats<T, K extends string>(
  defs: Record<K, StatDef<T>>,
  input: T
): K[] {
  return (Object.keys(defs) as K[]).filter((key) => defs[key].value(input));
}

export function pickStats<T, K extends string>(
  defs: Record<K, StatDef<T>>,
  keys: readonly K[],
  input: T
): Stat[] {
  return keys.flatMap((key) => {
    const value = defs[key].value(input);

    return value ? [{ label: defs[key].label, value }] : [];
  });
}

/** Defaults: los primeros con valor de una lista de preferencia. */
export function defaultStats<T, K extends string>(
  defs: Record<K, StatDef<T>>,
  preference: readonly K[],
  input: T
): K[] {
  const available = new Set(availableStats(defs, input));
  const preferred = preference.filter((key) => available.has(key));
  const rest = [...available].filter((key) => !preferred.includes(key));

  return [...preferred, ...rest].slice(0, MAX_STATS);
}

/**
 * Calor por músculo: series × 1 si es principal, × 0,5 si es secundario
 * (cardio sin series cuenta como 2), normalizado a la más trabajada.
 */
export function muscleHeat(
  exercises: readonly ShareExercise[]
): Partial<Record<MuscleId, number>> {
  const heat: Partial<Record<MuscleId, number>> = {};

  for (const exercise of exercises) {
    const sets = exercise.sets.length || (exercise.cardioMinutes > 0 ? 2 : 0);

    for (const id of exercise.primary) heat[id] = (heat[id] ?? 0) + sets;
    for (const id of exercise.secondary)
      heat[id] = (heat[id] ?? 0) + sets * 0.5;
  }
  const max = Math.max(0, ...Object.values(heat));

  if (max > 0) {
    for (const id of Object.keys(heat) as MuscleId[])
      heat[id] = heat[id]! / max;
  }

  return heat;
}

/** Sesión de ejemplo para la vista previa del entrenador. */
export const SAMPLE_SESSION: ShareSession = {
  sessionName: "Torso A",
  date: "2026-10-14",
  sessionNumber: 23,
  startTime: "18:02",
  // Hora local, para que la duración salga 64 min en cualquier zona.
  completedAt: new Date(2026, 9, 14, 19, 6).toISOString(),
  exercises: [
    {
      id: "1",
      exerciseId: "bench",
      name: "Press banca",
      primary: ["pectoral"],
      secondary: ["triceps", "deltoides_anterior"],
      sets: [
        { reps: 8, weightKg: 80 },
        { reps: 6, weightKg: 90 },
        { reps: 5, weightKg: 95 },
        { reps: 3, weightKg: 100 },
      ],
      recordIndex: 3,
      cardioMinutes: 0,
      cardioKm: 0,
      videoUrl: null,
    },
    {
      id: "2",
      exerciseId: "row",
      name: "Remo con barra",
      primary: ["dorsal"],
      secondary: ["biceps", "trapecio"],
      sets: [
        { reps: 10, weightKg: 70 },
        { reps: 10, weightKg: 70 },
        { reps: 8, weightKg: 75 },
      ],
      recordIndex: null,
      cardioMinutes: 0,
      cardioKm: 0,
      videoUrl: null,
    },
    {
      id: "3",
      exerciseId: "ohp",
      name: "Press militar",
      primary: ["deltoides_anterior"],
      secondary: ["deltoides_lateral", "triceps"],
      sets: [
        { reps: 10, weightKg: 40 },
        { reps: 8, weightKg: 45 },
        { reps: 7, weightKg: 45 },
      ],
      recordIndex: null,
      cardioMinutes: 0,
      cardioKm: 0,
      videoUrl: null,
    },
    {
      id: "4",
      exerciseId: "curl",
      name: "Curl con mancuernas",
      primary: ["biceps"],
      secondary: ["antebrazo"],
      sets: [
        { reps: 12, weightKg: 14 },
        { reps: 11, weightKg: 14 },
        { reps: 9, weightKg: 16 },
      ],
      recordIndex: null,
      cardioMinutes: 0,
      cardioKm: 0,
      videoUrl: null,
    },
  ],
};
