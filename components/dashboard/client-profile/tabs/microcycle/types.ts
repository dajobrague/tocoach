import type { ExerciseLog } from "../progress/types";

/** Per-set values resolved from an override's prescribed_sets, used by the UI. */
export interface PrescribedSetSpec {
  setNumber: number;
  reps: string | null;
  weightKg: number | null;
}

/** A single exercise prescribed inside a scheduled session. */
export interface PrescribedExercise {
  exerciseId: string;
  name: string;
  category: string;
  prescribedSets: number;
  /** Reps come back as TEXT from session_exercises (can be "10-12", "AMRAP", etc.). */
  prescribedReps: string | null;
  prescribedWeightKg: number | null;
  /**
   * Per-set values when the override has them. Empty array means "uniform"
   * (use prescribedSets/prescribedReps/prescribedWeightKg for every set).
   */
  perSet: PrescribedSetSpec[];
}

/** A single prescribed set inside an override (per-set granularity). */
export interface PrescribedSetRow {
  id: string;
  set_number: number;
  reps: string | null;
  weight_kg: number | null;
  notes: string | null;
}

/** A row from scheduled_session_exercises — the per-date override (Phase 3). */
export interface OverrideExerciseRow {
  id: string;
  exercise_order: number;
  /** Uniform fallback (used when prescribed_sets is empty). */
  sets: number | null;
  reps: string | null;
  weight_kg: number | null;
  duration_seconds: number | null;
  distance_meters: number | null;
  rest_seconds: number | null;
  notes: string | null;
  /** When non-empty, these per-set values are the source of truth. */
  prescribed_sets: PrescribedSetRow[];
  exercise: { id: string; name: string; category: string };
}

/** A session as it travels back from the trainer endpoint (template or actual). */
export interface SessionLite {
  id: string;
  name: string;
  session_exercises: Array<{
    id: string;
    exercise_order: number;
    sets: number | null;
    reps: string | null;
    weight_kg: number | null;
    exercise: { id: string; name: string; category: string };
  }>;
}

/** Result of the API: a scheduled_sessions row with its session + exercises. */
export interface ScheduledSessionRow {
  id: string;
  scheduled_date: string;
  status: "scheduled" | "completed" | "missed" | "cancelled" | "rescheduled";
  completion_date: string | null;
  session: SessionLite | null;
  /** Override rows — when present, they win over session.session_exercises. */
  override_exercises: OverrideExerciseRow[];
  /**
   * Sesión que el microciclo originalmente recomendaba para esta fecha.
   * Presente solo cuando el cliente divergió: la sesión visible (`session`)
   * ya es la que el cliente entrenó, y `originally_prescribed_session`
   * conserva la del template como referencia para mostrar un chip
   * informativo "Originalmente prescrito: X" en la UI.
   */
  originally_prescribed_session?: SessionLite | null;
  /** Autoría de la fila scheduled_sessions: 'trainer', 'client', o null para template virtual. */
  prescribed_by?: "trainer" | "client" | null;
}

export type DayClassification =
  | "complete"
  | "partial"
  | "pending"
  | "rest"
  | "future";

export interface DayAdherence {
  totalPrescribed: number;
  completedExercises: number;
  prescribedSetsTotal: number;
  loggedSetsTotal: number;
  prescribedLoadTotal: number;
  loggedLoadTotal: number;
  /** 0..1 — proportion of exercises with at least one logged set. */
  ejercicios: number;
  /** 0..1 — proportion of prescribed sets that were logged (clamped at 1). */
  series: number;
  /** Unclamped sets ratio (>1 when client did more sets than prescribed). */
  seriesRaw: number;
  /** True when loggedSetsTotal > prescribedSetsTotal on a day with any work. */
  hasOverage: boolean;
  /** 0..1 — proportion of prescribed load lifted. 1 when no prescribed load. */
  carga: number;
}

export interface DayMetrics {
  date: string;
  scheduledSession: ScheduledSessionRow | null;
  prescribed: PrescribedExercise[];
  logs: ExerciseLog[];
  adherence: DayAdherence;
  classification: DayClassification;
  isToday: boolean;
  isFuture: boolean;
}

export interface WeekMetrics {
  /** 7 entries, Monday first. */
  days: DayMetrics[];
  /** Logs whose scheduled_date sits inside the week but with no scheduled session. */
  orphansByDate: Map<string, ExerciseLog[]>;
}
