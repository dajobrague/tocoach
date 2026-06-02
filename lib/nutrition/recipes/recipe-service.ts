import type { SupabaseClient } from "@supabase/supabase-js";

const TABLE = "recipes";

export type RecipeStatus = "draft" | "active" | "archived";

/** A row of the `recipes` table (see migration 20260602163528). */
export interface RecipeRow {
  id: string;
  tenant_host: string;
  trainer_id: string;
  name: string;
  description: string | null;
  instructions: string | null;
  prep_time_min: number | null;
  cook_time_min: number | null;
  meal_type_tags: string[];
  status: RecipeStatus;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  sugar_g: number;
  fiber_g: number;
  sat_fat_g: number;
  sodium_mg: number;
  created_at: string;
  updated_at: string;
}

export interface RecipeCreateInput {
  name: string;
  description?: string;
  instructions?: string;
  mealTypeTags?: string[];
  prepTimeMin?: number;
  cookTimeMin?: number;
  status?: RecipeStatus;
}

export interface RecipeUpdateInput {
  name?: string;
  description?: string;
  instructions?: string;
  mealTypeTags?: string[];
  prepTimeMin?: number;
  cookTimeMin?: number;
  status?: RecipeStatus;
}

export interface RecipeListFilter {
  status?: RecipeStatus;
  mealType?: string;
  query?: string;
}

/** Thrown when recipe input fails validation (e.g. an empty name). */
export class RecipeValidationError extends Error {}

/**
 * Recipe shell CRUD. Every method is tenant-scoped: each query filters on
 * `tenant_host`, so one tenant can never read or mutate another's recipes.
 * `archive` is a soft delete (status='archived') — recipes are never hard
 * deleted. The Supabase client is injected for testability.
 */
export class RecipeService {
  private readonly client: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  async create(
    tenantHost: string,
    trainerId: string,
    input: RecipeCreateInput
  ): Promise<RecipeRow> {
    const name = input.name.trim();

    if (name.length === 0) {
      throw new RecipeValidationError("Recipe name is required");
    }

    const payload: Record<string, unknown> = {
      tenant_host: tenantHost,
      trainer_id: trainerId,
      name,
      meal_type_tags: input.mealTypeTags ?? [],
      status: input.status ?? "draft",
    };

    if (input.description !== undefined)
      payload.description = input.description;
    if (input.instructions !== undefined) {
      payload.instructions = input.instructions;
    }
    if (input.prepTimeMin !== undefined)
      payload.prep_time_min = input.prepTimeMin;
    if (input.cookTimeMin !== undefined)
      payload.cook_time_min = input.cookTimeMin;

    const { data, error } = await this.client
      .from(TABLE)
      .insert(payload)
      .select()
      .single();

    if (error !== null) {
      throw new Error(`RecipeService.create failed: ${error.message}`);
    }

    return data as RecipeRow;
  }

  async getById(tenantHost: string, id: string): Promise<RecipeRow | null> {
    const { data, error } = await this.client
      .from(TABLE)
      .select("*")
      .eq("tenant_host", tenantHost)
      .eq("id", id)
      .maybeSingle();

    if (error !== null) {
      throw new Error(`RecipeService.getById failed: ${error.message}`);
    }

    return (data as RecipeRow | null) ?? null;
  }

  async list(
    tenantHost: string,
    filter: RecipeListFilter
  ): Promise<RecipeRow[]> {
    let query = this.client
      .from(TABLE)
      .select("*")
      .eq("tenant_host", tenantHost);

    if (filter.status !== undefined) {
      query = query.eq("status", filter.status);
    }

    if (filter.mealType !== undefined && filter.mealType.length > 0) {
      query = query.contains("meal_type_tags", [filter.mealType]);
    }

    if (filter.query !== undefined && filter.query.length > 0) {
      query = query.ilike("name", `%${filter.query}%`);
    }

    const { data, error } = await query.order("created_at", {
      ascending: false,
    });

    if (error !== null) {
      throw new Error(`RecipeService.list failed: ${error.message}`);
    }

    return (data ?? []) as RecipeRow[];
  }

  async update(
    tenantHost: string,
    id: string,
    patch: RecipeUpdateInput
  ): Promise<RecipeRow | null> {
    const updates: Record<string, unknown> = {};

    if (patch.name !== undefined) {
      const name = patch.name.trim();

      if (name.length === 0) {
        throw new RecipeValidationError("Recipe name cannot be empty");
      }

      updates.name = name;
    }

    if (patch.description !== undefined)
      updates.description = patch.description;
    if (patch.instructions !== undefined) {
      updates.instructions = patch.instructions;
    }
    if (patch.mealTypeTags !== undefined) {
      updates.meal_type_tags = patch.mealTypeTags;
    }
    if (patch.prepTimeMin !== undefined)
      updates.prep_time_min = patch.prepTimeMin;
    if (patch.cookTimeMin !== undefined)
      updates.cook_time_min = patch.cookTimeMin;
    if (patch.status !== undefined) updates.status = patch.status;

    if (Object.keys(updates).length === 0) {
      return this.getById(tenantHost, id);
    }

    const { data, error } = await this.client
      .from(TABLE)
      .update(updates)
      .eq("tenant_host", tenantHost)
      .eq("id", id)
      .select()
      .maybeSingle();

    if (error !== null) {
      throw new Error(`RecipeService.update failed: ${error.message}`);
    }

    return (data as RecipeRow | null) ?? null;
  }

  async archive(tenantHost: string, id: string): Promise<RecipeRow | null> {
    const { data, error } = await this.client
      .from(TABLE)
      .update({ status: "archived" })
      .eq("tenant_host", tenantHost)
      .eq("id", id)
      .select()
      .maybeSingle();

    if (error !== null) {
      throw new Error(`RecipeService.archive failed: ${error.message}`);
    }

    return (data as RecipeRow | null) ?? null;
  }
}
