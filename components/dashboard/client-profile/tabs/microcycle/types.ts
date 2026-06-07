import type { ExerciseLog } from "../progress/types";

/** A single exercise prescribed inside a scheduled session. */
export interface PrescribedExercise {
  exerciseId: string;
  name: string;
  category: string;
  prescribedSets: number;
  /** Reps come back as TEXT from session_exercises (can be "10-12", "AMRAP", etc.). */
  prescribedReps: string | null;
  prescribedWeightKg: number | null;
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
  /**
   * Sesión que el microciclo originalmente recomendaba para esta fecha.
   * Presente solo cuando el cliente divergió: la sesión visible (`session`)
   * ya es la que el cliente entrenó, y `originally_prescribed_session`
   * conserva la del template como referencia para mostrar un chip
   * informativo "Originalmente prescrito: X" en la UI.
   */
  originally_prescribed_session?: SessionLite | null;
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

export interface SessionEntry {
  scheduledSession: ScheduledSessionRow;
  prescribed: PrescribedExercise[];
  logs: ExerciseLog[];
  adherence: DayAdherence;
  classification: DayClassification;
}

export interface DayMetrics {
  date: string;
  /**
   * One entry per (date, session) the client or trainer touched. Empty
   * when the day is rest both in template and activity.
   */
  sessions: SessionEntry[];
  /**
   * Sesión que el trainer recomienda para el día (microciclo). null =
   * rest day. Se usa para anotar "Recomendado: X" en el header del día
   * cuando no aparece en `sessions`.
   */
  recommendedSessionName: string | null;
  isToday: boolean;
  isFuture: boolean;
}

export interface WeekMetrics {
  /** 7 entries, Monday first. */
  days: DayMetrics[];
  /** Logs whose scheduled_date sits inside the week but with no scheduled session. */
  orphansByDate: Map<string, ExerciseLog[]>;
}
