// "Subir peso en la próxima sesión": el entrenador lo marca al revisar un
// ejercicio de un día concreto y se guarda en
// session_exercises.metadata.increase_weight_after = ese día (YYYY-MM-DD).
// El cliente ve el aviso en cualquier sesión POSTERIOR a ese día, y el flag
// se borra cuando finaliza el ejercicio en una de ellas.

export const INCREASE_WEIGHT_KEY = "increase_weight_after";

const YMD = /^\d{4}-\d{2}-\d{2}$/;

/** ¿El aviso aplica a una sesión del día `date`? */
export function isIncreaseWeightPending(after: unknown, date: string): boolean {
  return typeof after === "string" && YMD.test(after) && date > after;
}
