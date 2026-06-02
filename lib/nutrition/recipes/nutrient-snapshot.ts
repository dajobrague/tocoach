import type { NutrientsPer100g } from "@/lib/nutrition/food-source";

/** The 8 per-100g nutrient keys frozen into a recipe_ingredients snapshot. */
export const NUTRIENT_KEYS = [
  "kcal",
  "protein_g",
  "carbs_g",
  "fat_g",
  "sugar_g",
  "fiber_g",
  "sat_fat_g",
  "sodium_mg",
] as const;

/**
 * Defensively pick the 8 known nutrient keys from an untrusted record (an OFF
 * snapshot, an ingredients cache row, or a request body), coercing each to a
 * finite number. Non-finite / missing values are simply omitted.
 */
export function pickNutrients(
  source: Record<string, unknown>
): Partial<NutrientsPer100g> {
  const out: Partial<NutrientsPer100g> = {};

  for (const key of NUTRIENT_KEYS) {
    const value = Number(source[key]);

    if (Number.isFinite(value)) {
      out[key] = value;
    }
  }

  return out;
}
