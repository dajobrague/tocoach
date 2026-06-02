import type { IngredientContribution, NutrientTotals } from "./macro-rollup";
import type { NutrientsPer100g } from "@/lib/nutrition/food-source";
import type { SupabaseClient } from "@supabase/supabase-js";

import { rollupRecipeTotals } from "./macro-rollup";

/** Shape we read from recipe_ingredients (untrusted/loosely-typed JSON). */
interface RecipeIngredientRow {
  quantity: number | string | null;
  unit: string | null;
  nutrient_snapshot: unknown;
}

/**
 * Recompute a recipe's stored per-serving nutrient totals from its ingredient
 * lines and persist them (invariant §4.2). The Supabase client is injected for
 * testability.
 *
 * v1 treats `quantity` as grams. The `unit` column is read but not converted —
 * non-gram units are treated as grams for now; real unit conversion is a later
 * ticket.
 */
export async function recomputeRecipeTotals(
  recipeId: string,
  client: SupabaseClient
): Promise<NutrientTotals> {
  const { data, error } = await client
    .from("recipe_ingredients")
    .select("quantity, unit, nutrient_snapshot")
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
    // v1: quantity is grams regardless of unit.
    quantityGrams: Number(row.quantity),
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
