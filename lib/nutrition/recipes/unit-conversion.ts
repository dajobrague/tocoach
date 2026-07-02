/**
 * Ingredient unit handling for recipe macro math.
 *
 * Nutrients are stored per-100g, so every ingredient quantity must resolve to a
 * gram weight before the rollup can scale it. Supported units:
 *
 *   - `g`  — grams, 1:1.
 *   - `ml` — millilitres, treated as 1 g/ml (density ≈ 1; a documented
 *            approximation good enough for coaching macros).
 *   - `lt` — litres, 1000 g.
 *   - `u`  — pieces. A piece has no intrinsic weight, so the line carries a
 *            `gramsPerUnit` value (e.g. 1 egg = 60 g); grams = quantity ×
 *            gramsPerUnit. Missing/invalid → contributes 0 grams.
 *
 * `gramsPerUnit` is only meaningful for `u`; it is ignored for the others.
 */
export type RecipeUnit = "g" | "ml" | "lt" | "u";

export const RECIPE_UNITS: readonly RecipeUnit[] = ["g", "ml", "lt", "u"];

/** Short Spanish labels for the unit selector. */
export const RECIPE_UNIT_LABELS: Record<RecipeUnit, string> = {
  g: "g",
  ml: "ml",
  lt: "lt",
  u: "u",
};

export function isRecipeUnit(value: unknown): value is RecipeUnit {
  return (
    typeof value === "string" &&
    (RECIPE_UNITS as readonly string[]).includes(value)
  );
}

/**
 * Normalise an arbitrary stored/legacy unit to a supported one. Unknown or
 * missing units fall back to grams — the historical default for every existing
 * row (see migration 20260602163528).
 */
export function normalizeUnit(value: unknown): RecipeUnit {
  return isRecipeUnit(value) ? value : "g";
}

/** Coerce to a finite number; non-finite/missing → 0. */
function toFinite(value: unknown): number {
  const n = Number(value);

  return Number.isFinite(n) ? n : 0;
}

/**
 * Convert a quantity in the given unit to grams for macro scaling. Pure and
 * total: any non-finite input degrades to 0 rather than throwing or producing
 * NaN, so the rollup never null-propagates.
 */
export function toGrams(
  quantity: unknown,
  unit: unknown,
  gramsPerUnit?: unknown
): number {
  const amount = toFinite(quantity);

  switch (normalizeUnit(unit)) {
    case "ml":
      return amount;
    case "lt":
      return amount * 1000;
    case "u":
      return amount * toFinite(gramsPerUnit);
    case "g":
    default:
      return amount;
  }
}
