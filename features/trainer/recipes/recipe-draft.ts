import type {
  FoodSearchResult,
  ManualIngredientInput,
  RecipeIngredientItem,
} from "./recipe-api";

import { LIBRARY_DEFAULT_QUANTITY } from "./recipe-api";

import { rollupRecipeTotals } from "@/lib/nutrition/recipes/macro-rollup";
import { toGrams } from "@/lib/nutrition/recipes/unit-conversion";

/**
 * Client-side draft model for the recipe editor. Ingredient edits are buffered
 * locally as `RecipeIngredientItem`s and only persisted when the trainer clicks
 * "Guardar" (via a single full-list replace). New, not-yet-saved lines carry a
 * `tmp-` id so the save payload knows to insert vs update them.
 */

let tempCounter = 0;

/** A client-only id for a line the trainer added but hasn't saved yet. */
export function makeTempId(): string {
  tempCounter += 1;

  return `tmp-${tempCounter}`;
}

export function isTempId(id: string): boolean {
  return id.startsWith("tmp-");
}

const MANUAL_NUTRIENT_KEYS = [
  "kcal",
  "protein_g",
  "carbs_g",
  "fat_g",
  "sugar_g",
  "fiber_g",
  "sat_fat_g",
  "sodium_mg",
] as const;

/** Build a draft line from a food-search result (unsaved; temp id). */
export function draftFromFood(food: FoodSearchResult): RecipeIngredientItem {
  return {
    id: makeTempId(),
    // Keep the cache-row link — it's what lets serving data (native units,
    // grams-per-piece) be hydrated for this line later.
    ingredient_id: food.id ?? null,
    name_snapshot: food.name,
    brand: food.brand ?? null,
    image_url: food.imageUrl ?? null,
    nutrient_snapshot: { ...food.nutrientsPer100g },
    quantity: LIBRARY_DEFAULT_QUANTITY,
    unit: food.defaultUnit ?? "g",
    grams_per_unit: null,
    sort_order: 0,
  };
}

/** Build a draft line from a manual entry, coercing the 8 nutrients. */
export function draftFromManual(
  input: ManualIngredientInput
): RecipeIngredientItem {
  const nutrients: Record<string, number> = {};

  for (const key of MANUAL_NUTRIENT_KEYS) {
    const value = Number(input.nutrients[key]);

    nutrients[key] = Number.isFinite(value) ? value : 0;
  }

  return {
    id: makeTempId(),
    ingredient_id: null,
    name_snapshot: input.name.trim(),
    brand: null,
    image_url: null,
    nutrient_snapshot: nutrients,
    quantity: input.quantity,
    unit: "g",
    grams_per_unit: null,
    sort_order: 0,
  };
}

/** Shallow-equal for two per-100g nutrient records (same keys, same values). */
function nutrientsEqual(
  a: Record<string, number>,
  b: Record<string, number>
): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);

  for (const key of keys) {
    if ((a[key] ?? 0) !== (b[key] ?? 0)) return false;
  }

  return true;
}

/**
 * True when the draft list differs from the saved list in a way that must be
 * persisted: length, order, membership, any line's quantity/unit/grams, or its
 * per-100g nutrients (trainers may correct inaccurate external-API macros).
 * Name snapshots stay frozen so they are not compared.
 */
export function ingredientsEqual(
  a: RecipeIngredientItem[],
  b: RecipeIngredientItem[]
): boolean {
  if (a.length !== b.length) return false;

  return a.every((item, index) => {
    const other = b[index];

    return (
      other !== undefined &&
      item.id === other.id &&
      item.quantity === other.quantity &&
      item.unit === other.unit &&
      item.grams_per_unit === other.grams_per_unit &&
      nutrientsEqual(item.nutrient_snapshot, other.nutrient_snapshot)
    );
  });
}

/** Live per-serving totals for the draft, computed the same way the server does. */
export function previewTotals(items: RecipeIngredientItem[]) {
  return rollupRecipeTotals(
    items.map((item) => ({
      quantityGrams: toGrams(item.quantity, item.unit, item.grams_per_unit),
      nutrientsPer100g: item.nutrient_snapshot,
    }))
  );
}

/**
 * Build the `PUT /ingredients` body from the draft. Existing lines send their
 * id (+ quantity/unit/grams) and their per-100g nutrients, so trainer macro
 * corrections persist; new (`tmp-`) lines send the full frozen snapshot so the
 * server can insert them. Array order becomes sort_order.
 */
export function buildReplaceIngredientsBody(items: RecipeIngredientItem[]): {
  ingredients: Record<string, unknown>[];
} {
  return {
    ingredients: items.map((item) => {
      const line: Record<string, unknown> = {
        quantity: item.quantity,
        unit: item.unit,
        grams_per_unit: item.grams_per_unit,
        nutrients_per_100g: item.nutrient_snapshot,
      };

      if (isTempId(item.id)) {
        line.name = item.name_snapshot;
        if (item.brand !== null) line.brand = item.brand;
        if (item.image_url !== null) line.image_url = item.image_url;
        if (item.ingredient_id !== null)
          line.ingredient_id = item.ingredient_id;
      } else {
        line.id = item.id;
      }

      return line;
    }),
  };
}
