/**
 * Pure attribution logic: deciding whether an exercise log belongs to a
 * specific PLANNED slot.
 *
 * Background: `exercise_logs` historically linked only to `exercise_id` +
 * `scheduled_session_id`. Once the library-selector let the same library
 * exercise be reused across many planned slots/sessions, matching a log to a
 * planned exercise by `exercise_id` alone made ONE log mark EVERY occurrence
 * "done" (the reported bug). Logs now carry `session_exercise_id` (the exact
 * planned slot = `session_exercises.id`); attribution keys off it, with a
 * session-scoped `exercise_id` fallback for legacy/backfill-null logs.
 *
 * Extracted from active-session-view.tsx so the rule is unit-testable.
 */

/** Minimal shape of an exercise log needed for slot attribution. */
export interface AttributableLog {
  exercise_id?: string | null;
  /** The specific planned slot this log was recorded against (new logs). */
  session_exercise_id?: string | null;
  /** Resolved template session id (from the scheduled_sessions join). */
  session_id?: string | null;
}

/** Minimal shape of a planned exercise (a `session_exercises` slot). */
export interface AttributablePlannedExercise {
  exercise_id?: string;
  /** The slot id (`session_exercises.id`). Absent for off-plan extras. */
  session_exercise_id?: string;
}

/**
 * Whether `log` should mark the planned `plannedExercise` (within `sessionId`)
 * as done. The rule:
 *
 *   - Off-plan extra (planned has no slot id): pure `exercise_id` match.
 *   - Log carries a slot id: require EXACT slot equality. This is what fixes
 *     the false-positive — a log for slotA never marks slotB even when both
 *     slots share the same library `exercise_id`.
 *   - Legacy log (no slot id): fall back to `exercise_id` match, session-scoped
 *     (`log.session_id` absent or equal to `sessionId`) so a legacy log from a
 *     different same-day session doesn't bleed across.
 */
export function logMatchesSlot(
  log: AttributableLog,
  plannedExercise: AttributablePlannedExercise,
  sessionId: string
): boolean {
  const slotId = plannedExercise.session_exercise_id;

  // Off-plan extra (no slot conocido): conserva el match por exercise_id puro.
  if (typeof slotId !== "string" || slotId.length === 0) {
    return (
      Boolean(log.exercise_id) &&
      log.exercise_id === plannedExercise.exercise_id
    );
  }

  const logSlotId = log.session_exercise_id;

  // Match preciso por slot (logs nuevos/backfilled).
  if (typeof logSlotId === "string" && logSlotId.length > 0) {
    return logSlotId === slotId;
  }

  // Fallback legacy (log sin slot): mismo exercise_id, acotado a esta sesión.
  if (!log.exercise_id || log.exercise_id !== plannedExercise.exercise_id) {
    return false;
  }

  return log.session_id == null || log.session_id === sessionId;
}
