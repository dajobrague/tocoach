import type { NutrientsPer100g } from "@/lib/nutrition/food-source";

/**
 * Recipe macro rollup (invariant §4.2).
 *
 * Pure function: recipe totals = the sum of each ingredient's per-100g values
 * scaled by its quantity. One recipe = one serving, so these are absolute
 * per-serving totals. Missing / undefined / NaN values contribute 0 — never
 * null-propagate — and nothing is rounded (callers decide display precision).
 */

/** Absolute per-recipe (per-serving) totals: the same 8 keys as NutrientsPer100g. */
export interface NutrientTotals {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  sugar_g: number;
  fiber_g: number;
  sat_fat_g: number;
  sodium_mg: number;
}

/** One ingredient's contribution; the per-100g snapshot may omit keys. */
export interface IngredientContribution {
  quantityGrams: number;
  nutrientsPer100g: Partial<NutrientsPer100g>;
}

const NUTRIENT_KEYS = [
  "kcal",
  "protein_g",
  "carbs_g",
  "fat_g",
  "sugar_g",
  "fiber_g",
  "sat_fat_g",
  "sodium_mg",
] as const;

/** Coerce to a finite number; undefined/NaN/Infinity become 0. */
function toFinite(value: number | undefined): number {
  return value !== undefined && Number.isFinite(value) ? value : 0;
}

export function rollupRecipeTotals(
  ingredients: IngredientContribution[]
): NutrientTotals {
  const totals: NutrientTotals = {
    kcal: 0,
    protein_g: 0,
    carbs_g: 0,
    fat_g: 0,
    sugar_g: 0,
    fiber_g: 0,
    sat_fat_g: 0,
    sodium_mg: 0,
  };

  for (const ingredient of ingredients) {
    const factor = toFinite(ingredient.quantityGrams) / 100;

    for (const key of NUTRIENT_KEYS) {
      totals[key] += toFinite(ingredient.nutrientsPer100g[key]) * factor;
    }
  }

  return totals;
}
