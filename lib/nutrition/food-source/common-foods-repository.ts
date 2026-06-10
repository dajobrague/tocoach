import type { FoodResult } from "./types";
import type { SupabaseClient } from "@supabase/supabase-js";

const TABLE = "common_foods";
const MAX_RESULTS = 10;

/** A row of the global `common_foods` seed table (migration 20260610110000). */
export interface CommonFoodRow {
  id: string;
  name: string;
  name_normalized: string;
  category: string;
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

/**
 * Lowercase + strip combining accents so "plátano" and "platano" match the
 * pre-normalized `name_normalized` column without the unaccent extension.
 */
export function normalizeFoodQuery(query: string): string {
  return query
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** Read-only lookup over the global common-foods seed. */
export interface CommonFoodsRepository {
  search(query: string): Promise<FoodResult[]>;
}

/** Supabase-backed {@link CommonFoodsRepository}. Not tenant-scoped (global). */
export class SupabaseCommonFoodsRepository implements CommonFoodsRepository {
  private readonly client: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  async search(query: string): Promise<FoodResult[]> {
    const normalized = normalizeFoodQuery(query);

    if (normalized.length === 0) {
      return [];
    }

    const { data, error } = await this.client
      .from(TABLE)
      .select("*")
      .ilike("name_normalized", `%${normalized}%`)
      .order("name_normalized")
      .limit(MAX_RESULTS);

    if (error !== null) {
      throw new Error(`common_foods search failed: ${error.message}`);
    }

    return ((data ?? []) as CommonFoodRow[]).map(commonFoodToResult);
  }
}

/** Map a seed row to the source-agnostic FoodResult shape (sourceRef = row id). */
export function commonFoodToResult(row: CommonFoodRow): FoodResult {
  return {
    source: "seed",
    sourceRef: row.id,
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
}
