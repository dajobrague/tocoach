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
  default_unit: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  sugar_g: number;
  fiber_g: number;
  sat_fat_g: number;
  sodium_mg: number;
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
  default_unit: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  sugar_g: number;
  fiber_g: number;
  sat_fat_g: number;
  sodium_mg: number;
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

  return insert;
}

/** Persistence boundary for cached ingredients. Always tenant-scoped. */
export interface IngredientRepository {
  findCachedByQuery(
    tenantHost: string,
    query: string
  ): Promise<IngredientRow[]>;
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
