import type { NutrientsPer100g } from "@/lib/nutrition/food-source";
import type { SupabaseClient } from "@supabase/supabase-js";

import { freezeIngredient } from "./ingredient-freeze";
import { RecipeService } from "./recipe-service";
import { recomputeRecipeTotals } from "./recompute-recipe-totals";

// Re-exported so existing importers (routes) keep their import path.
export { RecipeIngredientValidationError } from "./ingredient-freeze";

const TABLE = "recipe_ingredients";

/** A row of the `recipe_ingredients` table (see migration 20260602163528). */
export interface RecipeIngredientRow {
  id: string;
  recipe_id: string;
  ingredient_id: string | null;
  name_snapshot: string;
  brand: string | null;
  image_url: string | null;
  quantity: number;
  unit: string;
  /** Grams per piece for unit="u" lines; null for g/ml/lt. */
  grams_per_unit: number | null;
  nutrient_snapshot: Record<string, unknown>;
  sort_order: number;
  created_at: string;
}

export interface AddIngredientInput {
  /** When set, freeze name + nutrients from this tenant-scoped cache row. */
  ingredientId?: string;
  /** Required for free-text lines (no ingredientId). */
  name?: string;
  /** Frozen brand for display; absent for unbranded/raw foods. */
  brand?: string;
  /** Frozen product thumbnail URL for display; absent when none. */
  imageUrl?: string;
  quantity: number;
  unit?: string;
  /** Grams per piece when unit="u"; null/omitted for g/ml/lt. */
  gramsPerUnit?: number | null;
  sortOrder?: number;
  /** Per-100g values for a free-text line. */
  nutrientsPer100g?: Partial<NutrientsPer100g>;
}

export interface UpdateIngredientInput {
  name?: string;
  brand?: string;
  imageUrl?: string;
  quantity?: number;
  unit?: string;
  gramsPerUnit?: number | null;
  sortOrder?: number;
  nutrientsPer100g?: Partial<NutrientsPer100g>;
}

/**
 * One line in a full-list replace. `id` identifies an existing row to keep
 * (only its quantity/unit/grams_per_unit/order change — snapshots are frozen);
 * omit `id` for a new line, which freezes from `name` + `nutrientsPer100g`.
 * Array order defines sort_order.
 */
export interface ReplaceIngredientSpec {
  id?: string;
  name?: string;
  brand?: string;
  imageUrl?: string;
  quantity: number;
  unit?: string;
  gramsPerUnit?: number | null;
  nutrientsPer100g?: Partial<NutrientsPer100g>;
}

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
      // sort_order is the trainer's chosen order; created_at + id are stable
      // tie-breakers so equal/legacy sort_order values keep insertion order and
      // an edit never reshuffles the list.
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true })
      .order("id", { ascending: true });

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

    const frozen = await freezeIngredient(this.client, tenantHost, input);
    const sortOrder = input.sortOrder ?? (await this.nextSortOrder(recipeId));
    const payload = {
      recipe_id: recipeId,
      ingredient_id: input.ingredientId ?? null,
      name_snapshot: frozen.name,
      brand: frozen.brand ?? null,
      image_url: frozen.imageUrl ?? null,
      quantity: input.quantity,
      unit: input.unit ?? "g",
      grams_per_unit: input.gramsPerUnit ?? null,
      nutrient_snapshot: frozen.nutrients,
      sort_order: sortOrder,
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
    if (patch.brand !== undefined) updates.brand = patch.brand;
    if (patch.imageUrl !== undefined) updates.image_url = patch.imageUrl;
    if (patch.quantity !== undefined) updates.quantity = patch.quantity;
    if (patch.unit !== undefined) updates.unit = patch.unit;
    if (patch.gramsPerUnit !== undefined) {
      updates.grams_per_unit = patch.gramsPerUnit;
    }
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

  /**
   * Persist a new order for the recipe's ingredient lines. `orderedIds` is the
   * full list of ingredient-row ids in the desired order; each row's sort_order
   * is set to its index. Ids not belonging to the recipe are ignored (the
   * `recipe_id` filter no-ops them). Returns the re-ordered list, or null when
   * the recipe is not found for the tenant.
   */
  async reorder(
    tenantHost: string,
    recipeId: string,
    orderedIds: string[]
  ): Promise<RecipeIngredientRow[] | null> {
    const owned = await this.recipes.getById(tenantHost, recipeId);

    if (owned === null) {
      return null;
    }

    for (let index = 0; index < orderedIds.length; index += 1) {
      const id = orderedIds[index];

      if (id === undefined) continue;

      const { error } = await this.client
        .from(TABLE)
        .update({ sort_order: index })
        .eq("id", id)
        .eq("recipe_id", recipeId);

      if (error !== null) {
        throw new Error(
          `RecipeIngredientService.reorder failed: ${error.message}`
        );
      }
    }

    return this.list(tenantHost, recipeId);
  }

  /**
   * Replace a recipe's entire ingredient list in one shot (the editor's explicit
   * "save"). Rows whose id is absent from `specs` are deleted; specs with a known
   * id are updated (quantity/unit/grams_per_unit/order — plus the per-100g
   * nutrient snapshot when the spec carries one, so a trainer can correct
   * inaccurate external-API values); specs without an id are inserted, freezing
   * name + nutrients. Totals recompute once at the end. Array order sets
   * sort_order. Returns the new list, or null when the recipe is not found for
   * the tenant.
   */
  async replaceAll(
    tenantHost: string,
    recipeId: string,
    specs: ReplaceIngredientSpec[]
  ): Promise<RecipeIngredientRow[] | null> {
    const owned = await this.recipes.getById(tenantHost, recipeId);

    if (owned === null) {
      return null;
    }

    const { data: existingData, error: existingError } = await this.client
      .from(TABLE)
      .select("id")
      .eq("recipe_id", recipeId);

    if (existingError !== null) {
      throw new Error(
        `RecipeIngredientService.replaceAll load failed: ${existingError.message}`
      );
    }

    const existingIds = new Set(
      (existingData ?? []).map((row) => (row as { id: string }).id)
    );
    const keepIds = new Set(
      specs
        .map((spec) => spec.id)
        .filter((id): id is string => id !== undefined && existingIds.has(id))
    );

    const toDelete = [...existingIds].filter((id) => keepIds.has(id) === false);

    if (toDelete.length > 0) {
      const { error } = await this.client
        .from(TABLE)
        .delete()
        .eq("recipe_id", recipeId)
        .in("id", toDelete);

      if (error !== null) {
        throw new Error(
          `RecipeIngredientService.replaceAll delete failed: ${error.message}`
        );
      }
    }

    for (let index = 0; index < specs.length; index += 1) {
      const spec = specs[index];

      if (spec === undefined) continue;

      if (spec.id !== undefined && existingIds.has(spec.id)) {
        const { error } = await this.client
          .from(TABLE)
          .update({
            quantity: spec.quantity,
            unit: spec.unit ?? "g",
            grams_per_unit: spec.gramsPerUnit ?? null,
            sort_order: index,
            // Trainer-corrected per-100g macros (external APIs are imprecise).
            ...(spec.nutrientsPer100g !== undefined
              ? { nutrient_snapshot: spec.nutrientsPer100g }
              : {}),
          })
          .eq("id", spec.id)
          .eq("recipe_id", recipeId);

        if (error !== null) {
          throw new Error(
            `RecipeIngredientService.replaceAll update failed: ${error.message}`
          );
        }

        continue;
      }

      const addInput: AddIngredientInput = { quantity: spec.quantity };

      if (spec.name !== undefined) addInput.name = spec.name;
      if (spec.brand !== undefined) addInput.brand = spec.brand;
      if (spec.imageUrl !== undefined) addInput.imageUrl = spec.imageUrl;
      if (spec.nutrientsPer100g !== undefined) {
        addInput.nutrientsPer100g = spec.nutrientsPer100g;
      }

      const frozen = await freezeIngredient(this.client, tenantHost, addInput);
      const { error } = await this.client.from(TABLE).insert({
        recipe_id: recipeId,
        ingredient_id: null,
        name_snapshot: frozen.name,
        brand: frozen.brand ?? null,
        image_url: frozen.imageUrl ?? null,
        quantity: spec.quantity,
        unit: spec.unit ?? "g",
        grams_per_unit: spec.gramsPerUnit ?? null,
        nutrient_snapshot: frozen.nutrients,
        sort_order: index,
      });

      if (error !== null) {
        throw new Error(
          `RecipeIngredientService.replaceAll insert failed: ${error.message}`
        );
      }
    }

    await recomputeRecipeTotals(recipeId, this.client);

    return this.list(tenantHost, recipeId);
  }

  /** Next append position: one past the current max sort_order (0 if empty). */
  private async nextSortOrder(recipeId: string): Promise<number> {
    const { data, error } = await this.client
      .from(TABLE)
      .select("sort_order")
      .eq("recipe_id", recipeId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error !== null) {
      throw new Error(
        `RecipeIngredientService.nextSortOrder failed: ${error.message}`
      );
    }

    if (data === null) {
      return 0;
    }

    const max = Number((data as { sort_order: unknown }).sort_order);

    return Number.isFinite(max) ? max + 1 : 0;
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
}
