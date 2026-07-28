// Helpers puros para duplicar sesiones/ejercicios (Fase 2 — llamada 15 Jul).
// La lógica con IO vive en el endpoint; esto es lo testeable: derivar el
// nombre de la copia y mapear filas de session_exercises al clon.

/** Fila de session_exercises tal como sale del SELECT * (solo lo que se clona). */
export interface SessionExerciseRow {
  exercise_id: string;
  exercise_order: number;
  custom_name?: string | null;
  sets?: number | null;
  reps?: string | null;
  duration_seconds?: number | null;
  rest_seconds?: number | null;
  weight_kg?: number | null;
  distance_meters?: number | null;
  notes?: string | null;
  metadata?: Record<string, unknown> | null;
}

/** Nombre por defecto de la copia: "Empujes A" → "Empujes A (copia)". */
export function duplicateName(sourceName: string | null | undefined): string {
  const base = (sourceName ?? "").trim();

  return base.length > 0 ? `${base} (copia)` : "Sesión (copia)";
}

/**
 * Mapea las filas del ejercicio origen a inserts para la sesión clon.
 * Copia TODO lo prescriptivo — incluido custom_name, que el clon de
 * save-as-template olvidaba — y respeta exercise_order original.
 */
export function cloneSessionExerciseRows(
  rows: SessionExerciseRow[],
  target: { tenantHost: string; sessionId: string }
): Array<Record<string, unknown>> {
  return rows.map((row) => ({
    tenant_host: target.tenantHost,
    session_id: target.sessionId,
    exercise_id: row.exercise_id,
    exercise_order: row.exercise_order,
    custom_name: row.custom_name ?? null,
    sets: row.sets ?? null,
    reps: row.reps ?? null,
    duration_seconds: row.duration_seconds ?? null,
    rest_seconds: row.rest_seconds ?? null,
    weight_kg: row.weight_kg ?? null,
    distance_meters: row.distance_meters ?? null,
    notes: row.notes ?? null,
    metadata: row.metadata ?? null,
  }));
}
