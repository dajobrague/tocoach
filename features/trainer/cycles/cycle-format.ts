import type { CycleStatus } from "./cycle-api";

type ChipColor = "default" | "success" | "warning";

export const CYCLE_STATUS: Record<
  CycleStatus,
  { label: string; color: ChipColor; dot: string }
> = {
  draft: { label: "Borrador", color: "warning", dot: "bg-warning-400" },
  active: { label: "Activo", color: "success", dot: "bg-success-500" },
  archived: { label: "Archivado", color: "default", dot: "bg-gray-300" },
};

export interface MealVisual {
  icon: string;
  bg: string;
  fg: string;
}

/** Map a meal label to an icon + colour, by keyword. Falls back to neutral. */
export function mealVisual(label: string): MealVisual {
  const value = label.toLowerCase();

  if (/desayuno|breakfast|brunch/.test(value)) {
    return {
      icon: "solar:sun-2-linear",
      bg: "bg-blue-50",
      fg: "text-blue-600",
    };
  }
  if (/almuerzo|comida|lunch/.test(value)) {
    return {
      icon: "solar:chef-hat-linear",
      bg: "bg-emerald-50",
      fg: "text-emerald-600",
    };
  }
  if (/cena|dinner/.test(value)) {
    return {
      icon: "solar:moon-stars-linear",
      bg: "bg-purple-50",
      fg: "text-purple-600",
    };
  }
  if (/snack|merienda|colaci/.test(value)) {
    return {
      icon: "solar:cup-hot-linear",
      bg: "bg-amber-50",
      fg: "text-amber-600",
    };
  }

  return {
    icon: "solar:cup-hot-linear",
    bg: "bg-gray-100",
    fg: "text-default-500",
  };
}

/** "3 jun 2026" style short date; falls back to the raw value if unparseable. */
export function formatStartDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00`);

  if (Number.isNaN(date.getTime())) return iso;

  return date.toLocaleDateString("es", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
