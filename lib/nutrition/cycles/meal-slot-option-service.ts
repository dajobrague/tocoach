import type { OptionSnapshot, SnapshotMedia } from "./option-snapshot";
import type { SupabaseClient } from "@supabase/supabase-js";

import { buildOptionSnapshot } from "./option-snapshot";

import { RecipeService } from "@/lib/nutrition/recipes/recipe-service";

const OPTIONS_TABLE = "meal_slot_options";
const SLOTS_TABLE = "meal_slots";
const RECIPE_INGREDIENTS_TABLE = "recipe_ingredients";
const RECIPE_MEDIA_TABLE = "recipe_media";
const INGREDIENTS_TABLE = "ingredients";

/** A row of `meal_slot_options` (see migration 20260603052805). */
export interface MealSlotOptionRow {
  id: string;
  slot_id: string;
  tenant_host: string;
  source_type: "recipe" | "food";
  source_ref_id: string;
  item_snapshot: OptionSnapshot;
  position: number;
  created_at: string;
  updated_at: string;
}

/**
 * Adds options to a meal slot, freezing a self-contained snapshot of the source
 * recipe/food at assignment time (§4.1). Every method first confirms the parent
 * slot belongs to `tenantHost`, and reads the source through the same tenant
 * scope — so one tenant can neither attach to another's slot nor freeze
 * another's recipe/food. Returns `null` when the slot or the source is not found
 * for the tenant (callers map that to a 404). Once written, the snapshot is
 * never updated by this service, so later library edits cannot mutate it.
 */
export class MealSlotOptionService {
  private readonly client: SupabaseClient;
  private readonly recipes: RecipeService;

  constructor(client: SupabaseClient) {
    this.client = client;
    this.recipes = new RecipeService(client);
  }

  async addRecipeOption(
    tenantHost: string,
    slotId: string,
    recipeId: string,
    position?: number
  ): Promise<MealSlotOptionRow | null> {
    const slotOwned = await this.slotExists(tenantHost, slotId);

    if (slotOwned === false) {
      return null;
    }

    const snapshot = await this.freezeSource(tenantHost, "recipe", recipeId);

    if (snapshot === null) {
      return null;
    }

    return this.insertOption(
      tenantHost,
      slotId,
      "recipe",
      recipeId,
      snapshot,
      position
    );
  }

  /**
   * Freeze a self-contained {@link OptionSnapshot} from a tenant-scoped recipe
   * or food (§4.1) — the same freeze `addRecipeOption`/`addFoodOption` write.
   * Reused by the overrides layer so a swap freezes identically. Returns `null`
   * when the source is not found for the tenant. `quantity` (grams) applies to
   * a food source only.
   */
  async freezeSource(
    tenantHost: string,
    sourceType: "recipe" | "food",
    sourceRefId: string,
    quantity = 0
  ): Promise<OptionSnapshot | null> {
    if (sourceType === "recipe") {
      const recipe = await this.recipes.getById(tenantHost, sourceRefId);

      if (recipe === null) {
        return null;
      }

      const [ingredients, media] = await Promise.all([
        this.readRecipeIngredients(sourceRefId),
        this.readRecipeMedia(sourceRefId),
      ]);

      return buildOptionSnapshot({
        type: "recipe",
        recipe: {
          id: recipe.id,
          name: recipe.name,
          instructions: recipe.instructions,
          ingredients,
          media,
        },
      });
    }

    const food = await this.readIngredient(tenantHost, sourceRefId);

    if (food === null) {
      return null;
    }

    return buildOptionSnapshot({
      type: "food",
      food: {
        id: sourceRefId,
        name: typeof food.name === "string" ? food.name : "",
        quantity,
        nutrientsPer100g: food,
      },
    });
  }

  async addFoodOption(
    tenantHost: string,
    slotId: string,
    ingredientId: string,
    quantity: number,
    position?: number
  ): Promise<MealSlotOptionRow | null> {
    const slotOwned = await this.slotExists(tenantHost, slotId);

    if (slotOwned === false) {
      return null;
    }

    const snapshot = await this.freezeSource(
      tenantHost,
      "food",
      ingredientId,
      quantity
    );

    if (snapshot === null) {
      return null;
    }

    return this.insertOption(
      tenantHost,
      slotId,
      "food",
      ingredientId,
      snapshot,
      position
    );
  }

  async listForSlot(
    tenantHost: string,
    slotId: string
  ): Promise<MealSlotOptionRow[] | null> {
    const slotOwned = await this.slotExists(tenantHost, slotId);

    if (slotOwned === false) {
      return null;
    }

    const { data, error } = await this.client
      .from(OPTIONS_TABLE)
      .select("*")
      .eq("tenant_host", tenantHost)
      .eq("slot_id", slotId)
      .order("position", { ascending: true });

    if (error !== null) {
      throw new Error(
        `MealSlotOptionService.listForSlot failed: ${error.message}`
      );
    }

    return (data ?? []) as MealSlotOptionRow[];
  }

  /** Reorder an option (tenant-scoped). Returns null when not found. */
  async updateOption(
    tenantHost: string,
    optionId: string,
    patch: { position?: number }
  ): Promise<MealSlotOptionRow | null> {
    if (patch.position === undefined) {
      return this.getOption(tenantHost, optionId);
    }

    const { data, error } = await this.client
      .from(OPTIONS_TABLE)
      .update({ position: patch.position })
      .eq("tenant_host", tenantHost)
      .eq("id", optionId)
      .select()
      .maybeSingle();

    if (error !== null) {
      throw new Error(
        `MealSlotOptionService.updateOption failed: ${error.message}`
      );
    }

    return (data as MealSlotOptionRow | null) ?? null;
  }

  /** Delete an option (tenant-scoped). Returns null when not found. */
  async deleteOption(
    tenantHost: string,
    optionId: string
  ): Promise<MealSlotOptionRow | null> {
    const { data, error } = await this.client
      .from(OPTIONS_TABLE)
      .delete()
      .eq("tenant_host", tenantHost)
      .eq("id", optionId)
      .select()
      .maybeSingle();

    if (error !== null) {
      throw new Error(
        `MealSlotOptionService.deleteOption failed: ${error.message}`
      );
    }

    return (data as MealSlotOptionRow | null) ?? null;
  }

  private async getOption(
    tenantHost: string,
    optionId: string
  ): Promise<MealSlotOptionRow | null> {
    const { data, error } = await this.client
      .from(OPTIONS_TABLE)
      .select("*")
      .eq("tenant_host", tenantHost)
      .eq("id", optionId)
      .maybeSingle();

    if (error !== null) {
      throw new Error(
        `MealSlotOptionService.getOption failed: ${error.message}`
      );
    }

    return (data as MealSlotOptionRow | null) ?? null;
  }

  private async insertOption(
    tenantHost: string,
    slotId: string,
    sourceType: "recipe" | "food",
    sourceRefId: string,
    snapshot: OptionSnapshot,
    position?: number
  ): Promise<MealSlotOptionRow> {
    const { data, error } = await this.client
      .from(OPTIONS_TABLE)
      .insert({
        slot_id: slotId,
        tenant_host: tenantHost,
        source_type: sourceType,
        source_ref_id: sourceRefId,
        item_snapshot: snapshot,
        position: position ?? 0,
      })
      .select()
      .single();

    if (error !== null) {
      throw new Error(
        `MealSlotOptionService.insertOption failed: ${error.message}`
      );
    }

    return data as MealSlotOptionRow;
  }

  private async slotExists(
    tenantHost: string,
    slotId: string
  ): Promise<boolean> {
    const { data, error } = await this.client
      .from(SLOTS_TABLE)
      .select("id")
      .eq("tenant_host", tenantHost)
      .eq("id", slotId)
      .maybeSingle();

    if (error !== null) {
      throw new Error(
        `MealSlotOptionService.slotExists failed: ${error.message}`
      );
    }

    return data !== null;
  }

  private async readRecipeIngredients(recipeId: string) {
    const { data, error } = await this.client
      .from(RECIPE_INGREDIENTS_TABLE)
      .select("name_snapshot, quantity, unit, nutrient_snapshot")
      .eq("recipe_id", recipeId)
      .order("sort_order", { ascending: true });

    if (error !== null) {
      throw new Error(
        `MealSlotOptionService.readRecipeIngredients failed: ${error.message}`
      );
    }

    return (data ?? []).map((row) => ({
      name: (row as { name_snapshot: string }).name_snapshot,
      quantity: (row as { quantity: number | string | null }).quantity,
      unit: (row as { unit: string | null }).unit,
      nutrientSnapshot:
        (row as { nutrient_snapshot: Record<string, unknown> | null })
          .nutrient_snapshot ?? {},
    }));
  }

  private async readRecipeMedia(recipeId: string): Promise<SnapshotMedia[]> {
    const { data, error } = await this.client
      .from(RECIPE_MEDIA_TABLE)
      .select("type, url, orientation")
      .eq("recipe_id", recipeId)
      .order("sort_order", { ascending: true });

    if (error !== null) {
      throw new Error(
        `MealSlotOptionService.readRecipeMedia failed: ${error.message}`
      );
    }

    return (data ?? []).map((row) => {
      const media = row as {
        type: "image" | "video";
        url: string;
        orientation: "vertical" | "horizontal" | null;
      };

      return {
        type: media.type,
        url: media.url,
        orientation: media.orientation,
      };
    });
  }

  private async readIngredient(
    tenantHost: string,
    ingredientId: string
  ): Promise<Record<string, unknown> | null> {
    const { data, error } = await this.client
      .from(INGREDIENTS_TABLE)
      .select(
        "name, kcal, protein_g, carbs_g, fat_g, sugar_g, fiber_g, sat_fat_g, sodium_mg"
      )
      .eq("tenant_host", tenantHost)
      .eq("id", ingredientId)
      .maybeSingle();

    if (error !== null) {
      throw new Error(
        `MealSlotOptionService.readIngredient failed: ${error.message}`
      );
    }

    return data as Record<string, unknown> | null;
  }
}
