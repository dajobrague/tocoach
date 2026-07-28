import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * ¿Los logs FINALIZADOS del cliente cubren todos los slots del template de la
 * sesión? Atribución por slot (session_exercises.id ← session_exercise_id del
 * log) con fallback legacy por exercise_id de librería — la misma regla que
 * usa el auto-completado del guardado de logs, extraída para que el endpoint
 * de "marcar/desmarcar completado" y el guardado nunca diverjan.
 *
 * Lanza en errores de query (el caller decide si es best-effort o no).
 */
export async function isSessionFullyCovered(
  supabase: SupabaseClient,
  scheduledSessionId: string,
  sessionId: string,
  clientId: number
): Promise<boolean> {
  const [{ data: logs, error: logsError }, { data: tmpl, error: tmplError }] =
    await Promise.all([
      supabase
        .from("exercise_logs")
        .select("exercise_id, session_exercise_id")
        .eq("scheduled_session_id", scheduledSessionId)
        .eq("client_id", clientId)
        .not("finalized_at", "is", null),
      supabase
        .from("session_exercises")
        .select("id, exercise_id")
        .eq("session_id", sessionId),
    ]);

  if (logsError) {
    throw new Error(`coverage logs fetch failed: ${logsError.message}`);
  }
  if (tmplError) {
    throw new Error(`coverage template fetch failed: ${tmplError.message}`);
  }

  const loggedSlotIds = new Set(
    (logs ?? [])
      .map((r) => r.session_exercise_id)
      .filter((id): id is string => typeof id === "string" && id.length > 0)
  );

  // Logs legacy (sin slot) se CUENTAN por ejercicio, no se usan como set:
  // con slots duplicados (mismo exercise_id dos veces — común desde que
  // existe "duplicar ejercicio"), un único log legacy no puede cubrir los
  // dos slots a la vez.
  const legacyLogCounts = new Map<string, number>();

  for (const log of logs ?? []) {
    const slotId = log.session_exercise_id;

    if (typeof slotId === "string" && slotId.length > 0) continue;
    legacyLogCounts.set(
      log.exercise_id,
      (legacyLogCounts.get(log.exercise_id) ?? 0) + 1
    );
  }

  const requiredSlots = tmpl ?? [];

  if (requiredSlots.length === 0) {
    return false;
  }

  const uncoveredByExercise = new Map<string, number>();

  for (const slot of requiredSlots) {
    if (loggedSlotIds.has(slot.id)) continue;
    uncoveredByExercise.set(
      slot.exercise_id,
      (uncoveredByExercise.get(slot.exercise_id) ?? 0) + 1
    );
  }

  return [...uncoveredByExercise].every(
    ([exerciseId, needed]) => (legacyLogCounts.get(exerciseId) ?? 0) >= needed
  );
}
