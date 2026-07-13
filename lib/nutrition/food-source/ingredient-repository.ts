import type { FoodResult, NutrientsPer100g } from "./types";
import type { SupabaseClient } from "@supabase/supabase-js";

const TABLE = "ingredients";

/** A row of the `ingredients` cache table (see migration 20260602155047). */
export interface IngredientRow {
  id: string;
  tenant_host: string;
  source: "off" | "manual" | "seed";
  source_ref: string | null;
  name: string;
  brand: string | null;
  image_url: string | null;
  default_unit: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  sugar_g: number;
  fiber_g: number;
  sat_fat_g: number;
  sodium_mg: number;
  /** Serving label/weight from OFF (migration 20260713110000); all null until
   *  the row is enriched via the v2 product API (search results carry none). */
  serving_size: string | null;
  serving_quantity: number | null;
  serving_quantity_unit: string | null;
  nutrient_extra: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** Column shape written on insert (DB fills id/timestamps/nutrient_extra). */
export interface IngredientInsert {
  tenant_host: string;
  source: "off" | "manual" | "seed";
  source_ref: string | null;
  name: string;
  brand?: string;
  image_url?: string;
  default_unit: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  sugar_g: number;
  fiber_g: number;
  sat_fat_g: number;
  sodium_mg: number;
  serving_size?: string;
  serving_quantity?: number;
  serving_quantity_unit?: string;
}

/** Caller-supplied data for a manual (non-source) ingredient. */
export interface ManualIngredientInput {
  name: string;
  brand?: string;
  nutrientsPer100g: NutrientsPer100g;
}

/** Map a cached row back to the source-agnostic FoodResult shape. */
export function rowToFoodResult(row: IngredientRow): FoodResult {
  const result: FoodResult = {
    id: row.id,
    source: row.source,
    sourceRef: row.source_ref,
    name: row.name,
    defaultUnit: "g",
    nutrientsPer100g: {
      // Numerics may arrive as strings from PostgREST — coerce defensively.
      kcal: Number(row.kcal),
      protein_g: Number(row.protein_g),
      carbs_g: Number(row.carbs_g),
      fat_g: Number(row.fat_g),
      sugar_g: Number(row.sugar_g),
      fiber_g: Number(row.fiber_g),
      sat_fat_g: Number(row.sat_fat_g),
      sodium_mg: Number(row.sodium_mg),
    },
  };

  if (row.brand !== null) {
    result.brand = row.brand;
  }

  if (row.image_url !== null) {
    result.imageUrl = row.image_url;
  }

  if (row.serving_size !== null && row.serving_size !== undefined) {
    result.servingSize = row.serving_size;
  }

  const servingQuantity = Number(row.serving_quantity);

  if (Number.isFinite(servingQuantity) && servingQuantity > 0) {
    result.servingQuantity = servingQuantity;
    result.servingQuantityUnit =
      row.serving_quantity_unit === "ml" ? "ml" : "g";
  }

  return result;
}

/** Build an insert payload from a FoodResult for a given tenant. */
export function foodResultToInsert(
  tenantHost: string,
  r: FoodResult
): IngredientInsert {
  const n = r.nutrientsPer100g;
  const insert: IngredientInsert = {
    tenant_host: tenantHost,
    source: r.source,
    source_ref: r.sourceRef,
    name: r.name,
    default_unit: r.defaultUnit,
    kcal: n.kcal,
    protein_g: n.protein_g,
    carbs_g: n.carbs_g,
    fat_g: n.fat_g,
    sugar_g: n.sugar_g,
    fiber_g: n.fiber_g,
    sat_fat_g: n.sat_fat_g,
    sodium_mg: n.sodium_mg,
  };

  if (r.brand !== undefined) {
    // Only set when present (exactOptionalPropertyTypes).
    insert.brand = r.brand;
  }

  if (r.imageUrl !== undefined) {
    insert.image_url = r.imageUrl;
  }

  if (r.servingSize !== undefined) {
    insert.serving_size = r.servingSize;
  }

  if (r.servingQuantity !== undefined) {
    insert.serving_quantity = r.servingQuantity;
    insert.serving_quantity_unit = r.servingQuantityUnit ?? "g";
  }

  return insert;
}

/** Serving fields written by the lazy OFF enrichment (nulls = "none found"). */
export interface ServingPatch {
  serving_size: string | null;
  serving_quantity: number | null;
  serving_quantity_unit: string | null;
}

/** Persistence boundary for cached ingredients. Always tenant-scoped. */
export interface IngredientRepository {
  findCachedByQuery(
    tenantHost: string,
    query: string
  ): Promise<IngredientRow[]>;
  findById(tenantHost: string, id: string): Promise<IngredientRow | null>;
  /** Persist serving data on a cached row; returns the updated row or null. */
  updateServing(
    tenantHost: string,
    id: string,
    patch: ServingPatch
  ): Promise<IngredientRow | null>;
  findCachedByRef(
    tenantHost: string,
    source: IngredientRow["source"],
    sourceRef: string
  ): Promise<IngredientRow | null>;
  /**
   * Persist ref-identified results that are not yet cached. Returns the cache
   * rows for EVERY ref-identified input (existing + newly inserted) so callers
   * can surface row ids (required to attach foods as meal_slot_options).
   */
  insertResolved(
    tenantHost: string,
    results: FoodResult[]
  ): Promise<IngredientRow[]>;
  insertManual(
    tenantHost: string,
    input: ManualIngredientInput
  ): Promise<IngredientRow>;
}

/** Supabase-backed {@link IngredientRepository}. */
export class SupabaseIngredientRepository implements IngredientRepository {
  private readonly client: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  async findCachedByQuery(
    tenantHost: string,
    query: string
  ): Promise<IngredientRow[]> {
    const { data, error } = await this.client
      .from(TABLE)
      .select("*")
      .eq("tenant_host", tenantHost)
      .ilike("name", `%${query}%`);

    if (error !== null) {
      throw new Error(`findCachedByQuery failed: ${error.message}`);
    }

    return (data ?? []) as IngredientRow[];
  }

  async findById(
    tenantHost: string,
    id: string
  ): Promise<IngredientRow | null> {
    const { data, error } = await this.client
      .from(TABLE)
      .select("*")
      .eq("tenant_host", tenantHost)
      .eq("id", id)
      .maybeSingle();

    if (error !== null) {
      throw new Error(`findById failed: ${error.message}`);
    }

    return (data as IngredientRow | null) ?? null;
  }

  async updateServing(
    tenantHost: string,
    id: string,
    patch: ServingPatch
  ): Promise<IngredientRow | null> {
    const { data, error } = await this.client
      .from(TABLE)
      .update(patch)
      .eq("tenant_host", tenantHost)
      .eq("id", id)
      .select()
      .maybeSingle();

    if (error !== null) {
      throw new Error(`updateServing failed: ${error.message}`);
    }

    return (data as IngredientRow | null) ?? null;
  }

  async findCachedByRef(
    tenantHost: string,
    source: IngredientRow["source"],
    sourceRef: string
  ): Promise<IngredientRow | null> {
    const { data, error } = await this.client
      .from(TABLE)
      .select("*")
      .eq("tenant_host", tenantHost)
      .eq("source", source)
      .eq("source_ref", sourceRef)
      .limit(1)
      .maybeSingle();

    if (error !== null) {
      throw new Error(`findCachedByRef failed: ${error.message}`);
    }

    return (data as IngredientRow | null) ?? null;
  }

  async insertResolved(
    tenantHost: string,
    results: FoodResult[]
  ): Promise<IngredientRow[]> {
    // Only ref-identified results are cacheable; manual/null refs are skipped.
    const cacheable = new Map<string, FoodResult>();

    for (const r of results) {
      if (r.sourceRef !== null) {
        const key = `${r.source}::${r.sourceRef}`;

        if (cacheable.has(key) === false) {
          cacheable.set(key, r);
        }
      }
    }

    if (cacheable.size === 0) {
      return [];
    }

    // One batched lookup for all refs instead of a round-trip per result.
    const refs = [...cacheable.values()].map((r) => r.sourceRef as string);
    const { data, error } = await this.client
      .from(TABLE)
      .select("*")
      .eq("tenant_host", tenantHost)
      .in("source_ref", refs);

    if (error !== null) {
      throw new Error(`insertResolved lookup failed: ${error.message}`);
    }

    const existing = ((data ?? []) as IngredientRow[]).filter((row) =>
      cacheable.has(`${row.source}::${row.source_ref}`)
    );
    const existingKeys = new Set(
      existing.map((row) => `${row.source}::${row.source_ref}`)
    );
    const toInsert: IngredientInsert[] = [];

    for (const [key, r] of cacheable) {
      if (existingKeys.has(key) === false) {
        toInsert.push(foodResultToInsert(tenantHost, r));
      }
    }

    if (toInsert.length === 0) {
      return existing;
    }

    const { data: inserted, error: insertError } = await this.client
      .from(TABLE)
      .insert(toInsert)
      .select();

    if (insertError !== null) {
      throw new Error(`insertResolved failed: ${insertError.message}`);
    }

    return [...existing, ...((inserted ?? []) as IngredientRow[])];
  }

  async insertManual(
    tenantHost: string,
    input: ManualIngredientInput
  ): Promise<IngredientRow> {
    const base: FoodResult = {
      source: "manual",
      sourceRef: null,
      name: input.name,
      defaultUnit: "g",
      nutrientsPer100g: input.nutrientsPer100g,
    };

    if (input.brand !== undefined) {
      base.brand = input.brand;
    }

    const { data, error } = await this.client
      .from(TABLE)
      .insert(foodResultToInsert(tenantHost, base))
      .select()
      .single();

    if (error !== null) {
      throw new Error(`insertManual failed: ${error.message}`);
    }

    return data as IngredientRow;
  }
}
