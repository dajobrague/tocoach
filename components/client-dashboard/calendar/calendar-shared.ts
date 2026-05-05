// Helpers visuales compartidos entre las tres grids del calendario
// (mes / quincena / semana). Live aparte para evitar duplicación entre
// los grid components que comparten la misma celda visual + el cálculo
// de "todos los ejercicios completados".

import type { CalendarEntrySession } from "./hooks/use-calendar-entries";

export const DAY_NAMES_SHORT = [
  "Dom",
  "Lun",
  "Mar",
  "Mié",
  "Jue",
  "Vie",
  "Sáb",
] as const;

export function isFullyCompleted(s: CalendarEntrySession): boolean {
  return s.exercises_total > 0 && s.exercises_completed >= s.exercises_total;
}

export function dotColor(type: CalendarEntrySession["session_type"]): string {
  switch (type) {
    case "strength":
      return "bg-primary";
    case "cardio":
      return "bg-danger";
    case "flexibility":
      return "bg-secondary";
    case "sports":
      return "bg-warning";
    case "recovery":
      return "bg-success";
    default:
      return "bg-default-400";
  }
}

export function chipColor(
  type: CalendarEntrySession["session_type"]
): "primary" | "danger" | "warning" | "secondary" | "success" | "default" {
  switch (type) {
    case "strength":
      return "primary";
    case "cardio":
      return "danger";
    case "flexibility":
      return "secondary";
    case "sports":
      return "warning";
    case "recovery":
      return "success";
    default:
      return "default";
  }
}

const TYPE_LABEL: Record<
  NonNullable<CalendarEntrySession["session_type"]>,
  string
> = {
  strength: "Fuerza",
  cardio: "Cardio",
  flexibility: "Flexibilidad",
  sports: "Deportes",
  recovery: "Descanso activo",
  other: "Otro",
};

export function typeLabel(type: CalendarEntrySession["session_type"]): string {
  return type ? TYPE_LABEL[type] : "Sesión";
}
