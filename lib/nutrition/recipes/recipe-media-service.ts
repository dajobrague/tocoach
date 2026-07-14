import type { SupabaseClient } from "@supabase/supabase-js";

import { randomUUID } from "node:crypto";

import { RecipeService } from "./recipe-service";

const TABLE = "recipe_media";
const BUCKET = "recipe-media";

export type RecipeMediaType = "image" | "video";
export type RecipeMediaOrientation = "vertical" | "horizontal";

/** A row of the `recipe_media` table (see migration 20260602163528). */
export interface RecipeMediaRow {
  id: string;
  recipe_id: string;
  type: RecipeMediaType;
  url: string;
  orientation: RecipeMediaOrientation | null;
  sort_order: number;
  created_at: string;
}

export interface CreateMediaInput {
  mediaType: RecipeMediaType;
  /** Already-compressed (for video) bytes to store. */
  buffer: Buffer;
  contentType: string;
  filename: string;
  orientation?: RecipeMediaOrientation;
  sortOrder?: number;
}

/**
 * Storage + row persistence for recipe media. Both methods first confirm the
 * parent recipe belongs to `tenantHost` (via RecipeService), so one tenant can
 * never attach to or delete another's recipe media. Objects are stored under
 * `[tenant_host]/recipes/[recipeId]/[uuid]`. Returns `null` when the recipe (or
 * the targeted media row) is not found for the tenant — callers map that to 404.
 */
export class RecipeMediaService {
  private readonly client: SupabaseClient;
  private readonly recipes: RecipeService;

  constructor(client: SupabaseClient) {
    this.client = client;
    this.recipes = new RecipeService(client);
  }

  async list(
    tenantHost: string,
    recipeId: string
  ): Promise<RecipeMediaRow[] | null> {
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
      throw new Error(`RecipeMediaService.list failed: ${error.message}`);
    }

    return (data ?? []) as RecipeMediaRow[];
  }

  /**
   * Current media for many recipes in a single query, grouped by `recipe_id`
   * and ordered by `sort_order`. Unlike {@link list} this does NOT re-check
   * ownership per recipe (that would defeat the batch): callers MUST pass ids
   * that are already tenant-scoped — e.g. the `source_ref_id`s of options that
   * were themselves loaded with a `tenant_host` filter. Recipes with no media
   * are simply absent from the map. Used to overlay live media onto frozen
   * option snapshots at read time.
   */
  async listByRecipeIds(
    recipeIds: string[]
  ): Promise<Map<string, RecipeMediaRow[]>> {
    const unique = [...new Set(recipeIds)];
    const byRecipe = new Map<string, RecipeMediaRow[]>();

    if (unique.length === 0) {
      return byRecipe;
    }

    const { data, error } = await this.client
      .from(TABLE)
      .select("*")
      .in("recipe_id", unique)
      .order("sort_order", { ascending: true });

    if (error !== null) {
      throw new Error(
        `RecipeMediaService.listByRecipeIds failed: ${error.message}`
      );
    }

    for (const row of (data ?? []) as RecipeMediaRow[]) {
      const list = byRecipe.get(row.recipe_id) ?? [];

      list.push(row);
      byRecipe.set(row.recipe_id, list);
    }

    return byRecipe;
  }

  async create(
    tenantHost: string,
    recipeId: string,
    input: CreateMediaInput
  ): Promise<RecipeMediaRow | null> {
    const owned = await this.recipes.getById(tenantHost, recipeId);

    if (owned === null) {
      return null;
    }

    const objectPath = `${tenantHost}/recipes/${recipeId}/${randomUUID()}${extensionOf(input.filename)}`;

    const upload = await this.client.storage
      .from(BUCKET)
      .upload(objectPath, input.buffer, {
        contentType: input.contentType,
        cacheControl: "3600",
        upsert: false,
      });

    if (upload.error !== null) {
      throw new Error(
        `RecipeMediaService.create upload failed: ${upload.error.message}`
      );
    }

    const {
      data: { publicUrl },
    } = this.client.storage.from(BUCKET).getPublicUrl(objectPath);

    const payload: Record<string, unknown> = {
      recipe_id: recipeId,
      type: input.mediaType,
      url: publicUrl,
      sort_order: input.sortOrder ?? 0,
    };

    if (input.orientation !== undefined) {
      payload.orientation = input.orientation;
    }

    const { data, error } = await this.client
      .from(TABLE)
      .insert(payload)
      .select()
      .single();

    if (error !== null) {
      // Best-effort cleanup so a failed insert doesn't orphan the object.
      await this.client.storage.from(BUCKET).remove([objectPath]);

      throw new Error(
        `RecipeMediaService.create insert failed: ${error.message}`
      );
    }

    return data as RecipeMediaRow;
  }

  async remove(
    tenantHost: string,
    recipeId: string,
    mediaId: string
  ): Promise<RecipeMediaRow | null> {
    const owned = await this.recipes.getById(tenantHost, recipeId);

    if (owned === null) {
      return null;
    }

    const { data, error } = await this.client
      .from(TABLE)
      .select("*")
      .eq("id", mediaId)
      .eq("recipe_id", recipeId)
      .maybeSingle();

    if (error !== null) {
      throw new Error(
        `RecipeMediaService.remove lookup failed: ${error.message}`
      );
    }

    if (data === null) {
      return null;
    }

    const row = data as RecipeMediaRow;
    const path = storagePathFromUrl(row.url);

    if (path !== null) {
      // Best-effort: never block the row delete on a storage hiccup.
      await this.client.storage.from(BUCKET).remove([path]);
    }

    const { error: deleteError } = await this.client
      .from(TABLE)
      .delete()
      .eq("id", mediaId)
      .eq("recipe_id", recipeId);

    if (deleteError !== null) {
      throw new Error(
        `RecipeMediaService.remove failed: ${deleteError.message}`
      );
    }

    return row;
  }
}

function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf(".");

  return dot >= 0 ? filename.slice(dot) : "";
}

/** Extract the in-bucket object path from a public storage URL. */
function storagePathFromUrl(url: string): string | null {
  const marker = `/${BUCKET}/`;
  const idx = url.indexOf(marker);

  if (idx < 0) {
    return null;
  }

  return url.slice(idx + marker.length);
}
