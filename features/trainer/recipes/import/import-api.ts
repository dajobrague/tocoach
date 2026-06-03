import type {
  CandidateIngredient,
  ImportResult,
  LegacyStatedMacros,
  RecipeCandidate,
} from "@/lib/nutrition/import";

import { rollupRecipeTotals } from "@/lib/nutrition/recipes/macro-rollup";

// ─── Client-side shapes ─────────────────────────────────────────────────────

export type { ImportResult, RecipeCandidate } from "@/lib/nutrition/import";

/** kcal + the 3 macros, the quad shown on import cards. */
export interface MacroQuad {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

// ─── Pure helpers (unit-tested) ─────────────────────────────────────────────

/**
 * The macros the imported recipe WILL compute, derived client-side from the
 * candidate's ingredient snapshots with the same rollup the server runs on
 * approve. This is 0 until the legacy lines carry usable macros — which is
 * exactly why it is shown distinctly from the legacy "stated" number.
 */
export function computeCandidateMacros(
  ingredients: CandidateIngredient[]
): MacroQuad {
  const totals = rollupRecipeTotals(
    ingredients.map((line) => ({
      quantityGrams: line.grams ?? 0,
      nutrientsPer100g: line.nutrients ?? {},
    }))
  );

  return {
    kcal: totals.kcal,
    protein_g: totals.protein_g,
    carbs_g: totals.carbs_g,
    fat_g: totals.fat_g,
  };
}

/** "687 kcal · 45P / 60C / 20G" — integers, for compact card display. */
export function formatCompactMacros(
  macros: LegacyStatedMacros | MacroQuad
): string {
  const round = (value: number | undefined): number =>
    Math.round(Number(value) || 0);

  return (
    `${round(macros.kcal)} kcal · ` +
    `${round(macros.protein_g)}P / ${round(macros.carbs_g)}C / ${round(macros.fat_g)}G`
  );
}

/** True when an option stated any macro worth showing as "Plan original". */
export function hasStatedMacros(
  macros: LegacyStatedMacros | undefined
): macros is LegacyStatedMacros {
  return macros !== undefined && Object.keys(macros).length > 0;
}

/** "3 importadas, 2 ya existían" — trainer-facing import summary. */
export function summarizeImportResult(result: ImportResult): string {
  const created = result.created.length;
  const duplicates = result.skipped.filter(
    (item) => item.reason === "duplicate"
  ).length;

  const plural = (count: number, one: string, many: string): string =>
    `${count} ${count === 1 ? one : many}`;

  const parts = [plural(created, "importada", "importadas")];

  if (duplicates > 0) {
    parts.push(plural(duplicates, "ya existía", "ya existían"));
  }

  return parts.join(", ");
}

// ─── Fetchers ───────────────────────────────────────────────────────────────

async function readData<T>(response: Response): Promise<T> {
  const data = await response.json();

  if (data?.success !== true) {
    throw new Error(data?.error ?? "Error de red");
  }

  return data.data as T;
}

export async function fetchImportCandidates(): Promise<RecipeCandidate[]> {
  const response = await fetch("/api/recipes/import/preview", {
    credentials: "same-origin",
    cache: "no-store",
  });

  return readData<RecipeCandidate[]>(response);
}

export async function approveImport(
  optionIds: string[]
): Promise<ImportResult> {
  const response = await fetch("/api/recipes/import/approve", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ optionIds }),
  });

  return readData<ImportResult>(response);
}
