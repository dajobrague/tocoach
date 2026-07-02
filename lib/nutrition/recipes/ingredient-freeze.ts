import type { NutrientsPer100g } from "@/lib/nutrition/food-source";
import type { SupabaseClient } from "@supabase/supabase-js";

import { pickNutrients } from "./nutrient-snapshot";

const INGREDIENTS_TABLE = "ingredients";

/** Thrown for invalid ingredient input (e.g. an unknown ingredient reference). */
export class RecipeIngredientValidationError extends Error {}

/** The snapshot fields frozen onto a recipe_ingredients row at add time. */
export interface FrozenIngredient {
  name: string;
  brand?: string;
  imageUrl?: string;
  nutrients: Partial<NutrientsPer100g>;
}

export interface FreezeInput {
  /** When set, freeze name + nutrients from this tenant-scoped cache row. */
  ingredientId?: string;
  /** Required for free-text lines (no ingredientId). */
  name?: string;
  brand?: string;
  imageUrl?: string;
  nutrientsPer100g?: Partial<NutrientsPer100g>;
}

/**
 * Resolve the frozen name + nutrients (+ optional brand/image) for a new
 * ingredient line. When `ingredientId` is given it reads the tenant-scoped
 * cache row (throwing if it doesn't belong to the tenant); otherwise it freezes
 * the provided free-text values. Snapshots are frozen so later cache edits never
 * mutate existing recipes.
 */
export async function freezeIngredient(
  client: SupabaseClient,
  tenantHost: string,
  input: FreezeInput
): Promise<FrozenIngredient> {
  if (input.ingredientId !== undefined) {
    const { data, error } = await client
      .from(INGREDIENTS_TABLE)
      .select(
        "name, brand, image_url, kcal, protein_g, carbs_g, fat_g, sugar_g, fiber_g, sat_fat_g, sodium_mg"
      )
      .eq("id", input.ingredientId)
      .eq("tenant_host", tenantHost)
      .maybeSingle();

    if (error !== null) {
      throw new Error(`freezeIngredient failed: ${error.message}`);
    }

    if (data === null) {
      throw new RecipeIngredientValidationError(
        "Ingredient not found for tenant"
      );
    }

    const row = data as Record<string, unknown>;
    const name = typeof row.name === "string" ? row.name : "";
    const frozen: FrozenIngredient = { name, nutrients: pickNutrients(row) };

    if (typeof row.brand === "string" && row.brand.length > 0) {
      frozen.brand = row.brand;
    }
    if (typeof row.image_url === "string" && row.image_url.length > 0) {
      frozen.imageUrl = row.image_url;
    }

    return frozen;
  }

  const name = input.name?.trim() ?? "";

  if (name.length === 0) {
    throw new RecipeIngredientValidationError("Ingredient name is required");
  }

  const frozen: FrozenIngredient = {
    name,
    nutrients: input.nutrientsPer100g ?? {},
  };

  // Mirror the cache path: only freeze non-empty values (never empty strings).
  const brand = input.brand?.trim() ?? "";
  const imageUrl = input.imageUrl?.trim() ?? "";

  if (brand.length > 0) frozen.brand = brand;
  if (imageUrl.length > 0) frozen.imageUrl = imageUrl;

  return frozen;
}
