import type { RecipeStatus } from "./recipe-query";

/** Coerce to a finite number; non-finite/missing → 0. */
export function toNumber(value: unknown): number {
  const n = Number(value);

  return Number.isFinite(n) ? n : 0;
}

export function formatKcal(value: unknown): string {
  return `${Math.round(toNumber(value))} kcal`;
}

/** Grams rounded to one decimal (e.g. "16.9 g", "5 g"). */
export function formatGrams(value: unknown): string {
  const rounded = Math.round(toNumber(value) * 10) / 10;

  return `${rounded} g`;
}

export interface MacroSummary {
  kcal: string;
  protein: string;
  carbs: string;
  fat: string;
}

export function recipeMacroSummary(recipe: {
  kcal: unknown;
  protein_g: unknown;
  carbs_g: unknown;
  fat_g: unknown;
}): MacroSummary {
  return {
    kcal: formatKcal(recipe.kcal),
    protein: formatGrams(recipe.protein_g),
    carbs: formatGrams(recipe.carbs_g),
    fat: formatGrams(recipe.fat_g),
  };
}

const STATUS_LABELS: Record<RecipeStatus, string> = {
  draft: "Borrador",
  active: "Activa",
  archived: "Archivada",
};

export function statusLabel(status: string): string {
  return STATUS_LABELS[status as RecipeStatus] ?? status;
}

export type StatusChipColor = "default" | "success" | "warning";

export function statusColor(status: string): StatusChipColor {
  if (status === "active") return "success";
  if (status === "archived") return "default";

  return "warning";
}
