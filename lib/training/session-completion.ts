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
  const legacyLoggedExerciseIds = new Set(
    (logs ?? [])
      .filter(
        (r) =>
          typeof r.session_exercise_id !== "string" ||
          r.session_exercise_id.length === 0
      )
      .map((r) => r.exercise_id)
  );
  const requiredSlots = tmpl ?? [];

  return (
    requiredSlots.length > 0 &&
    requiredSlots.every(
      (slot) =>
        loggedSlotIds.has(slot.id) ||
        legacyLoggedExerciseIds.has(slot.exercise_id)
    )
  );
}
