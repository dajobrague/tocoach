import type { FoodResult } from "./types";
import type { SupabaseClient } from "@supabase/supabase-js";

const TABLE = "common_foods";
const MAX_RESULTS = 10;
/** Candidatos que se traen para ordenar por relevancia antes de cortar. */
const MAX_CANDIDATES = 60;

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
      .limit(MAX_CANDIDATES);

    if (error !== null) {
      throw new Error(`common_foods search failed: ${error.message}`);
    }

    return rankSeedRows(normalized, (data ?? []) as CommonFoodRow[])
      .slice(0, MAX_RESULTS)
      .map(commonFoodToResult);
  }
}

/**
 * How well a normalized food name matches a normalized query (lower is
 * better): 0 exact — a parenthetical qualifier doesn't count, so "lentejas
 * (crudas)" is exact for "lentejas"; 1 starts with it; 2 a word starts with
 * it ("pechuga de pollo" for "pollo"); 3 any other substring ("repollo").
 */
export function matchTier(name: string, normalizedQuery: string): number {
  if (name === normalizedQuery) return 0;
  if (name.replace(/\s*\(.*$/, "") === normalizedQuery) return 0;
  if (name.startsWith(normalizedQuery)) return 1;
  if (name.includes(` ${normalizedQuery}`)) return 2;

  return 3;
}

/**
 * Best matches first (see {@link matchTier}); shorter names win ties. Without
 * this the alphabetical cut-off hid the staples once the seed grew past a
 * handful of matches per query.
 */
export function rankSeedRows(
  normalizedQuery: string,
  rows: CommonFoodRow[]
): CommonFoodRow[] {
  const tier = (name: string): number => matchTier(name, normalizedQuery);

  return [...rows].sort(
    (a, b) =>
      tier(a.name_normalized) - tier(b.name_normalized) ||
      a.name_normalized.length - b.name_normalized.length ||
      a.name_normalized.localeCompare(b.name_normalized)
  );
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
