import type { SupabaseClient } from "@supabase/supabase-js";

import {
  RecipeService,
  type RecipeRow,
} from "@/lib/nutrition/recipes/recipe-service";

const COMMUNITY_TABLE = "community_recipes";
const RECIPES_TABLE = "recipes";
const INGREDIENTS_TABLE = "recipe_ingredients";
const MEDIA_TABLE = "recipe_media";

/** Tag stamped on every imported copy — it materializes as a "Comunidad"
 *  folder in the library, so imports arrive pre-organized. */
const COMMUNITY_TAG = "Comunidad";

interface FrozenIngredient {
  name_snapshot: string;
  brand: string | null;
  quantity: number;
  unit: string;
  grams_per_unit: number | null;
  nutrient_snapshot: unknown;
  image_url: string | null;
  sort_order: number;
}

interface FrozenMedia {
  type: string;
  url: string;
  orientation: string | null;
  sort_order: number;
}

export interface CommunityRecipeRow {
  id: string;
  source_tenant_host: string;
  source_recipe_id: string;
  shared_by: string | null;
  name: string;
  description: string | null;
  instructions: string | null;
  prep_time_min: number | null;
  cook_time_min: number | null;
  meal_type_tags: string[];
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  sugar_g: number;
  fiber_g: number;
  sat_fat_g: number;
  sodium_mg: number;
  ingredients: FrozenIngredient[];
  media: FrozenMedia[];
  created_at: string;
  updated_at: string;
}

/** A catalog card: no frozen payload, plus derived display fields. */
export interface CommunityRecipeSummary {
  id: string;
  name: string;
  shared_by: string | null;
  meal_type_tags: string[];
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  ingredient_count: number;
  thumbnail_url: string | null;
  /** True when the viewing tenant is the sharer (hides the import button). */
  mine: boolean;
  updated_at: string;
}

/**
 * The shared recipe gallery (copy-install model). Sharing freezes the
 * recipe into the global catalog; importing copies the frozen payload into
 * the target tenant's own tables. No tenant table is ever read across
 * tenants — the catalog is the only global surface.
 */
export class CommunityRecipeService {
  constructor(private readonly client: SupabaseClient) {}

  /** Share (or refresh a previous share of) one of the tenant's recipes. */
  async share(tenantHost: string, recipeId: string): Promise<boolean> {
    const recipes = new RecipeService(this.client);
    const recipe = await recipes.getById(tenantHost, recipeId);

    if (recipe === null) {
      return false;
    }

    const [ingredients, media, sharedBy] = await Promise.all([
      this.loadIngredients(recipeId),
      this.loadMedia(recipeId),
      this.tenantName(tenantHost),
    ]);

    const { error } = await this.client.from(COMMUNITY_TABLE).upsert(
      {
        source_tenant_host: tenantHost,
        source_recipe_id: recipeId,
        shared_by: sharedBy,
        name: recipe.name,
        description: recipe.description,
        instructions: recipe.instructions,
        prep_time_min: recipe.prep_time_min,
        cook_time_min: recipe.cook_time_min,
        meal_type_tags: recipe.meal_type_tags,
        kcal: recipe.kcal,
        protein_g: recipe.protein_g,
        carbs_g: recipe.carbs_g,
        fat_g: recipe.fat_g,
        sugar_g: recipe.sugar_g,
        fiber_g: recipe.fiber_g,
        sat_fat_g: recipe.sat_fat_g,
        sodium_mg: recipe.sodium_mg,
        ingredients,
        media,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "source_tenant_host,source_recipe_id" }
    );

    if (error !== null) {
      throw new Error(`CommunityRecipeService.share failed: ${error.message}`);
    }

    return true;
  }

  /** Remove the tenant's share. Imported copies elsewhere are untouched. */
  async unshare(tenantHost: string, recipeId: string): Promise<boolean> {
    const { data, error } = await this.client
      .from(COMMUNITY_TABLE)
      .delete()
      .eq("source_tenant_host", tenantHost)
      .eq("source_recipe_id", recipeId)
      .select("id");

    if (error !== null) {
      throw new Error(
        `CommunityRecipeService.unshare failed: ${error.message}`
      );
    }

    return (data ?? []).length > 0;
  }

  /** Whether (and when) the tenant's recipe is currently shared. */
  async statusFor(
    tenantHost: string,
    recipeId: string
  ): Promise<{ shared: boolean; updated_at: string | null }> {
    const { data, error } = await this.client
      .from(COMMUNITY_TABLE)
      .select("updated_at")
      .eq("source_tenant_host", tenantHost)
      .eq("source_recipe_id", recipeId)
      .maybeSingle();

    if (error !== null) {
      throw new Error(
        `CommunityRecipeService.statusFor failed: ${error.message}`
      );
    }

    return {
      shared: data !== null,
      updated_at: (data as { updated_at: string } | null)?.updated_at ?? null,
    };
  }

  /** The catalog, newest first. Global read by design. */
  async list(
    viewerTenantHost: string,
    filter: { query?: string; tag?: string } = {}
  ): Promise<CommunityRecipeSummary[]> {
    let query = this.client
      .from(COMMUNITY_TABLE)
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(200);

    const q = filter.query?.trim();

    if (q !== undefined && q.length > 0) {
      query = query.ilike("name", `%${q}%`);
    }

    if (filter.tag !== undefined && filter.tag.length > 0) {
      query = query.contains("meal_type_tags", [filter.tag]);
    }

    const { data, error } = await query;

    if (error !== null) {
      throw new Error(`CommunityRecipeService.list failed: ${error.message}`);
    }

    return ((data ?? []) as CommunityRecipeRow[]).map((row) => ({
      id: row.id,
      name: row.name,
      shared_by: row.shared_by,
      meal_type_tags: row.meal_type_tags,
      kcal: Number(row.kcal),
      protein_g: Number(row.protein_g),
      carbs_g: Number(row.carbs_g),
      fat_g: Number(row.fat_g),
      ingredient_count: (row.ingredients ?? []).length,
      thumbnail_url:
        (row.media ?? []).find((item) => item.type === "image")?.url ?? null,
      mine: row.source_tenant_host === viewerTenantHost,
      updated_at: row.updated_at,
    }));
  }

  /**
   * Copy-install a catalog recipe into the target tenant's library: recipes
   * row (active, totals copied verbatim, "Comunidad" tag added), then the
   * frozen ingredient and media rows. Sequential inserts, no transaction —
   * a mid-flight failure leaves a visible, deletable partial copy.
   */
  async importToLibrary(
    communityId: string,
    targetTenantHost: string,
    trainerId: string
  ): Promise<RecipeRow | null> {
    const { data, error } = await this.client
      .from(COMMUNITY_TABLE)
      .select("*")
      .eq("id", communityId)
      .maybeSingle();

    if (error !== null) {
      throw new Error(
        `CommunityRecipeService.import load failed: ${error.message}`
      );
    }

    if (data === null) {
      return null;
    }

    const source = data as CommunityRecipeRow;
    const tags = [...source.meal_type_tags];

    if (
      tags.some((tag) => tag.trim().toLowerCase() === "comunidad") === false
    ) {
      tags.push(COMMUNITY_TAG);
    }

    const { data: created, error: createError } = await this.client
      .from(RECIPES_TABLE)
      .insert({
        tenant_host: targetTenantHost,
        trainer_id: trainerId,
        name: source.name,
        description: source.description,
        instructions: source.instructions,
        prep_time_min: source.prep_time_min,
        cook_time_min: source.cook_time_min,
        meal_type_tags: tags,
        status: "active",
        kcal: source.kcal,
        protein_g: source.protein_g,
        carbs_g: source.carbs_g,
        fat_g: source.fat_g,
        sugar_g: source.sugar_g,
        fiber_g: source.fiber_g,
        sat_fat_g: source.sat_fat_g,
        sodium_mg: source.sodium_mg,
      })
      .select()
      .single();

    if (createError !== null) {
      throw new Error(
        `CommunityRecipeService.import create failed: ${createError.message}`
      );
    }

    const recipe = created as RecipeRow;

    for (const line of source.ingredients ?? []) {
      const { error: lineError } = await this.client
        .from(INGREDIENTS_TABLE)
        .insert({
          recipe_id: recipe.id,
          ingredient_id: null,
          name_snapshot: line.name_snapshot,
          brand: line.brand,
          quantity: line.quantity,
          unit: line.unit,
          grams_per_unit: line.grams_per_unit,
          nutrient_snapshot: line.nutrient_snapshot,
          image_url: line.image_url,
          sort_order: line.sort_order,
        });

      if (lineError !== null) {
        throw new Error(
          `CommunityRecipeService.import ingredient failed: ${lineError.message}`
        );
      }
    }

    for (const item of source.media ?? []) {
      const { error: mediaError } = await this.client.from(MEDIA_TABLE).insert({
        recipe_id: recipe.id,
        type: item.type,
        url: item.url,
        orientation: item.orientation,
        sort_order: item.sort_order,
      });

      if (mediaError !== null) {
        throw new Error(
          `CommunityRecipeService.import media failed: ${mediaError.message}`
        );
      }
    }

    return recipe;
  }

  private async loadIngredients(recipeId: string): Promise<FrozenIngredient[]> {
    const { data, error } = await this.client
      .from(INGREDIENTS_TABLE)
      .select(
        "name_snapshot, brand, quantity, unit, grams_per_unit, nutrient_snapshot, image_url, sort_order"
      )
      .eq("recipe_id", recipeId)
      .order("sort_order", { ascending: true });

    if (error !== null) {
      throw new Error(
        `CommunityRecipeService.loadIngredients failed: ${error.message}`
      );
    }

    return (data ?? []) as FrozenIngredient[];
  }

  private async loadMedia(recipeId: string): Promise<FrozenMedia[]> {
    const { data, error } = await this.client
      .from(MEDIA_TABLE)
      .select("type, url, orientation, sort_order")
      .eq("recipe_id", recipeId)
      .order("sort_order", { ascending: true });

    if (error !== null) {
      throw new Error(
        `CommunityRecipeService.loadMedia failed: ${error.message}`
      );
    }

    return (data ?? []) as FrozenMedia[];
  }

  private async tenantName(tenantHost: string): Promise<string | null> {
    const { data } = await this.client
      .from("tenants")
      .select("name")
      .eq("host", tenantHost)
      .maybeSingle();

    return (data as { name: string | null } | null)?.name ?? null;
  }
}
