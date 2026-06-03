/**
 * Food-source abstraction (P0-T6).
 *
 * Defines the contract every food provider (Open Food Facts, manual entry,
 * future sources) implements. No provider logic, database, or network access
 * lives here — only types and the interface they satisfy.
 */

/** Macronutrient profile normalized to a 100g basis. All fields required. */
export interface NutrientsPer100g {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  sugar_g: number;
  fiber_g: number;
  sat_fat_g: number;
  sodium_mg: number;
}

/** A single resolved food item from any source. */
export interface FoodResult {
  /**
   * Ingredients-cache row id, present only for cache-backed results. Absent for
   * fresh source (OFF) hits that have not been persisted. Required to attach the
   * food as a meal_slot_option (the option freeze reads the cache row by id).
   */
  id?: string;
  /** Which source produced this result. */
  source: "off" | "manual";
  /** Stable, source-scoped identifier; null for ad-hoc manual entries. */
  sourceRef: string | null;
  name: string;
  /** Optional brand; absent (not `undefined`) when unknown. */
  brand?: string;
  /** Quantities are always expressed in grams for v2. */
  defaultUnit: "g";
  nutrientsPer100g: NutrientsPer100g;
}

/**
 * Pluggable food lookup. Implementations must not mutate shared state and
 * should resolve to `null`/`[]` rather than throwing when nothing matches.
 */
export interface FoodSource {
  search(query: string, locale?: string): Promise<FoodResult[]>;
  getByRef(sourceRef: string): Promise<FoodResult | null>;
  getByBarcode(code: string): Promise<FoodResult | null>;
}
