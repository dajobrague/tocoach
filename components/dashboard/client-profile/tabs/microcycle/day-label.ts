// Clasificación AGREGADA de un día para etiquetas (Hecho/Empezado/Sin hacer).
// Compartida por la tira semanal y la grilla mensual para que un mismo día
// nunca diga cosas distintas según la vista. Regla: "Hecho" exige TODAS las
// sesiones no-futuras completas; cualquier actividad parcial → "Empezado".

import type { DayClassification, DayMetrics } from "./types";

export function dayLabelClassification(day: DayMetrics): DayClassification {
  const isRest = day.sessions.length === 0;

  if (isRest) {
    return day.isFuture ? "future" : "rest";
  }

  const nonFuture = day.sessions.filter((s) => s.classification !== "future");

  if (nonFuture.length === 0) {
    return "future";
  }
  if (nonFuture.every((s) => s.classification === "complete")) {
    return "complete";
  }
  if (
    nonFuture.some(
      (s) => s.classification === "complete" || s.classification === "partial"
    )
  ) {
    return "partial";
  }

  return "pending";
}
