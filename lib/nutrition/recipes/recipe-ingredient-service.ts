import type { NutrientsPer100g } from "@/lib/nutrition/food-source";
import type { SupabaseClient } from "@supabase/supabase-js";

import { pickNutrients } from "./nutrient-snapshot";
import { RecipeService } from "./recipe-service";
import { recomputeRecipeTotals } from "./recompute-recipe-totals";

const TABLE = "recipe_ingredients";
const INGREDIENTS_TABLE = "ingredients";

/** A row of the `recipe_ingredients` table (see migration 20260602163528). */
export interface RecipeIngredientRow {
  id: string;
  recipe_id: string;
  ingredient_id: string | null;
  name_snapshot: string;
  quantity: number;
  unit: string;
  nutrient_snapshot: Record<string, unknown>;
  sort_order: number;
  created_at: string;
}

export interface AddIngredientInput {
  /** When set, freeze name + nutrients from this tenant-scoped cache row. */
  ingredientId?: string;
  /** Required for free-text lines (no ingredientId). */
  name?: string;
  quantity: number;
  unit?: string;
  sortOrder?: number;
  /** Per-100g values for a free-text line. */
  nutrientsPer100g?: Partial<NutrientsPer100g>;
}

export interface UpdateIngredientInput {
  name?: string;
  quantity?: number;
  unit?: string;
  sortOrder?: number;
  nutrientsPer100g?: Partial<NutrientsPer100g>;
}

/** Thrown for invalid ingredient input (e.g. an unknown ingredient reference). */
export class RecipeIngredientValidationError extends Error {}

/**
 * CRUD for a recipe's ingredient lines. Every method first confirms the parent
 * recipe belongs to `tenantHost` (via RecipeService), so one tenant can never
 * touch another's recipe ingredients. On add/update (with changes)/remove the
 * recipe's stored totals are recomputed. Returns `null` when the recipe (or the
 * targeted ingredient row) is not found for the tenant — callers map that to a
 * 404.
 */
export class RecipeIngredientService {
  private readonly client: SupabaseClient;
  private readonly recipes: RecipeService;

  constructor(client: SupabaseClient) {
    this.client = client;
    this.recipes = new RecipeService(client);
  }

  async list(
    tenantHost: string,
    recipeId: string
  ): Promise<RecipeIngredientRow[] | null> {
    const owned = await this.recipes.getById(tenantHost, recipeId);

    if (owned === null) {
      return null;
    }

    const { data, error } = await this.client
      .from(TABLE)
      .select("*")
      .eq("recipe_id", recipeId)
      .order("sort_order", { ascending: true });

    if (error !== null) {
      throw new Error(`RecipeIngredientService.list failed: ${error.message}`);
    }

    return (data ?? []) as RecipeIngredientRow[];
  }

  async add(
    tenantHost: string,
    recipeId: string,
    input: AddIngredientInput
  ): Promise<RecipeIngredientRow | null> {
    const owned = await this.recipes.getById(tenantHost, recipeId);

    if (owned === null) {
      return null;
    }

    const frozen = await this.freeze(tenantHost, input);
    const payload = {
      recipe_id: recipeId,
      ingredient_id: input.ingredientId ?? null,
      name_snapshot: frozen.name,
      quantity: input.quantity,
      unit: input.unit ?? "g",
      nutrient_snapshot: frozen.nutrients,
      sort_order: input.sortOrder ?? 0,
    };

    const { data, error } = await this.client
      .from(TABLE)
      .insert(payload)
      .select()
      .single();

    if (error !== null) {
      throw new Error(`RecipeIngredientService.add failed: ${error.message}`);
    }

    await recomputeRecipeTotals(recipeId, this.client);

    return data as RecipeIngredientRow;
  }

  async update(
    tenantHost: string,
    recipeId: string,
    ingredientRowId: string,
    patch: UpdateIngredientInput
  ): Promise<RecipeIngredientRow | null> {
    const owned = await this.recipes.getById(tenantHost, recipeId);

    if (owned === null) {
      return null;
    }

    const updates: Record<string, unknown> = {};

    if (patch.name !== undefined) updates.name_snapshot = patch.name;
    if (patch.quantity !== undefined) updates.quantity = patch.quantity;
    if (patch.unit !== undefined) updates.unit = patch.unit;
    if (patch.sortOrder !== undefined) updates.sort_order = patch.sortOrder;
    if (patch.nutrientsPer100g !== undefined) {
      updates.nutrient_snapshot = patch.nutrientsPer100g;
    }

    if (Object.keys(updates).length === 0) {
      return this.findRow(recipeId, ingredientRowId);
    }

    const { data, error } = await this.client
      .from(TABLE)
      .update(updates)
      .eq("id", ingredientRowId)
      .eq("recipe_id", recipeId)
      .select()
      .maybeSingle();

    if (error !== null) {
      throw new Error(
        `RecipeIngredientService.update failed: ${error.message}`
      );
    }

    if (data === null) {
      return null;
    }

    await recomputeRecipeTotals(recipeId, this.client);

    return data as RecipeIngredientRow;
  }

  async remove(
    tenantHost: string,
    recipeId: string,
    ingredientRowId: string
  ): Promise<RecipeIngredientRow | null> {
    const owned = await this.recipes.getById(tenantHost, recipeId);

    if (owned === null) {
      return null;
    }

    const { data, error } = await this.client
      .from(TABLE)
      .delete()
      .eq("id", ingredientRowId)
      .eq("recipe_id", recipeId)
      .select()
      .maybeSingle();

    if (error !== null) {
      throw new Error(
        `RecipeIngredientService.remove failed: ${error.message}`
      );
    }

    if (data === null) {
      return null;
    }

    await recomputeRecipeTotals(recipeId, this.client);

    return data as RecipeIngredientRow;
  }

  private async findRow(
    recipeId: string,
    ingredientRowId: string
  ): Promise<RecipeIngredientRow | null> {
    const { data, error } = await this.client
      .from(TABLE)
      .select("*")
      .eq("id", ingredientRowId)
      .eq("recipe_id", recipeId)
      .maybeSingle();

    if (error !== null) {
      throw new Error(
        `RecipeIngredientService.findRow failed: ${error.message}`
      );
    }

    return (data as RecipeIngredientRow | null) ?? null;
  }

  /** Resolve name_snapshot + nutrient_snapshot, freezing from cache if linked. */
  private async freeze(
    tenantHost: string,
    input: AddIngredientInput
  ): Promise<{ name: string; nutrients: Partial<NutrientsPer100g> }> {
    if (input.ingredientId !== undefined) {
      const { data, error } = await this.client
        .from(INGREDIENTS_TABLE)
        .select(
          "name, kcal, protein_g, carbs_g, fat_g, sugar_g, fiber_g, sat_fat_g, sodium_mg"
        )
        .eq("id", input.ingredientId)
        .eq("tenant_host", tenantHost)
        .maybeSingle();

      if (error !== null) {
        throw new Error(
          `RecipeIngredientService.freeze failed: ${error.message}`
        );
      }

      if (data === null) {
        throw new RecipeIngredientValidationError(
          "Ingredient not found for tenant"
        );
      }

      const row = data as Record<string, unknown>;
      const name = typeof row.name === "string" ? row.name : "";

      return { name, nutrients: pickNutrients(row) };
    }

    const name = input.name?.trim() ?? "";

    if (name.length === 0) {
      throw new RecipeIngredientValidationError("Ingredient name is required");
    }

    return { name, nutrients: input.nutrientsPer100g ?? {} };
  }
}
