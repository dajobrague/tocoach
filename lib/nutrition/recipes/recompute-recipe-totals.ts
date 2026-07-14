import type { IngredientContribution, NutrientTotals } from "./macro-rollup";
import type { NutrientsPer100g } from "@/lib/nutrition/food-source";
import type { SupabaseClient } from "@supabase/supabase-js";

import { rollupRecipeTotals } from "./macro-rollup";
import { toGrams } from "./unit-conversion";

/** Shape we read from recipe_ingredients (untrusted/loosely-typed JSON). */
interface RecipeIngredientRow {
  quantity: number | string | null;
  unit: string | null;
  grams_per_unit: number | string | null;
  nutrient_snapshot: unknown;
}

/**
 * Recompute a recipe's stored per-serving nutrient totals from its ingredient
 * lines and persist them (invariant §4.2). The Supabase client is injected for
 * testability.
 *
 * Each line's quantity is resolved to grams by unit (see `toGrams`): g/ml are
 * 1:1, lt ×1000, and pieces (`u`) use the line's `grams_per_unit`.
 */
export async function recomputeRecipeTotals(
  recipeId: string,
  client: SupabaseClient
): Promise<NutrientTotals> {
  const { data, error } = await client
    .from("recipe_ingredients")
    .select("quantity, unit, grams_per_unit, nutrient_snapshot")
    .eq("recipe_id", recipeId);

  if (error !== null) {
    throw new Error(`recomputeRecipeTotals: fetch failed: ${error.message}`);
  }

  const rows = (data ?? []) as RecipeIngredientRow[];
  const totals = rollupRecipeTotals(rows.map(toContribution));

  const { error: updateError } = await client
    .from("recipes")
    .update(totals)
    .eq("id", recipeId);

  if (updateError !== null) {
    throw new Error(
      `recomputeRecipeTotals: update failed: ${updateError.message}`
    );
  }

  return totals;
}

function toContribution(row: RecipeIngredientRow): IngredientContribution {
  return {
    quantityGrams: toGrams(row.quantity, row.unit, row.grams_per_unit),
    nutrientsPer100g: toNutrients(row.nutrient_snapshot),
  };
}

/** Read the per-100g snapshot defensively; rollup guards missing/NaN values. */
function toNutrients(snapshot: unknown): Partial<NutrientsPer100g> {
  if (typeof snapshot === "object" && snapshot !== null) {
    return snapshot as Partial<NutrientsPer100g>;
  }

  return {};
}
