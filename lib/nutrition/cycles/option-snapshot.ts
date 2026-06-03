import type { NutrientsPer100g } from "@/lib/nutrition/food-source";
import type { NutrientTotals } from "@/lib/nutrition/recipes/macro-rollup";

import { rollupRecipeTotals } from "@/lib/nutrition/recipes/macro-rollup";
import { pickNutrients } from "@/lib/nutrition/recipes/nutrient-snapshot";

/**
 * Snapshot-at-assignment (§4.1).
 *
 * `buildOptionSnapshot` produces a fully self-contained `item_snapshot` for a
 * meal_slot_option: everything the client view needs to render — name, steps,
 * image refs, every ingredient line with its quantity + per-100g nutrients, and
 * the rolled-up totals — with NO join back to the mutable recipe/ingredient
 * library. It is pure and deterministic: identical input always yields a
 * byte-for-byte identical object (fixed key order; totals via rollupRecipeTotals;
 * per-100g values normalized via pickNutrients). Freezing this at assignment
 * time is what makes a later library edit unable to mutate an existing option.
 */

export interface SnapshotImage {
  url: string;
  orientation: "vertical" | "horizontal" | null;
}

export type SnapshotMediaType = "image" | "video";

/** A frozen recipe media item — image or (vertical) video — for the snapshot. */
export interface SnapshotMedia {
  type: SnapshotMediaType;
  url: string;
  orientation: "vertical" | "horizontal" | null;
}

export interface SnapshotIngredient {
  name: string;
  /** Grams of this line in the option. */
  quantity: number;
  unit: string;
  nutrientsPer100g: Partial<NutrientsPer100g>;
}

export interface OptionSnapshot {
  sourceType: "recipe" | "food";
  /** Originating recipe/ingredient id (traceability only — not a live link). */
  sourceRefId: string;
  name: string;
  steps: string | null;
  /** Image-only convenience subset of {@link media} (back-compat). */
  images: SnapshotImage[];
  /** All recipe media (images + vertical video), in display order, with type. */
  media: SnapshotMedia[];
  ingredients: SnapshotIngredient[];
  totals: NutrientTotals;
}

/** A recipe read from the library (rows are loosely typed where jsonb-backed). */
export interface RecipeSnapshotInput {
  id: string;
  name: string;
  instructions: string | null;
  ingredients: Array<{
    name: string;
    quantity: number | string | null;
    unit: string | null;
    nutrientSnapshot: Record<string, unknown> | null;
  }>;
  /** All recipe media (image + video) in display order — the freeze source. */
  media: SnapshotMedia[];
}

/** A raw food (ingredients-cache row) assigned at a chosen quantity in grams. */
export interface FoodSnapshotInput {
  id: string;
  name: string;
  quantity: number;
  unit?: string | null;
  nutrientsPer100g: Record<string, unknown>;
}

export type SnapshotSource =
  | { type: "recipe"; recipe: RecipeSnapshotInput }
  | { type: "food"; food: FoodSnapshotInput };

export function buildOptionSnapshot(source: SnapshotSource): OptionSnapshot {
  return source.type === "recipe"
    ? buildRecipeSnapshot(source.recipe)
    : buildFoodSnapshot(source.food);
}

function buildRecipeSnapshot(recipe: RecipeSnapshotInput): OptionSnapshot {
  const ingredients: SnapshotIngredient[] = recipe.ingredients.map((line) => ({
    name: `${line.name ?? ""}`,
    quantity: toFinite(line.quantity),
    unit: line.unit !== null && line.unit !== undefined ? line.unit : "g",
    nutrientsPer100g: pickNutrients(line.nutrientSnapshot ?? {}),
  }));

  const media: SnapshotMedia[] = recipe.media.map((item) => ({
    type: item.type,
    url: item.url,
    orientation: item.orientation,
  }));

  return {
    sourceType: "recipe",
    sourceRefId: recipe.id,
    name: recipe.name,
    steps: nonEmptyOrNull(recipe.instructions),
    images: media
      .filter((item) => item.type === "image")
      .map((item) => ({ url: item.url, orientation: item.orientation })),
    media,
    ingredients,
    totals: totalsFrom(ingredients),
  };
}

function buildFoodSnapshot(food: FoodSnapshotInput): OptionSnapshot {
  const ingredient: SnapshotIngredient = {
    name: food.name,
    quantity: toFinite(food.quantity),
    unit: food.unit !== null && food.unit !== undefined ? food.unit : "g",
    nutrientsPer100g: pickNutrients(food.nutrientsPer100g),
  };

  return {
    sourceType: "food",
    sourceRefId: food.id,
    name: food.name,
    steps: null,
    images: [],
    media: [],
    ingredients: [ingredient],
    totals: totalsFrom([ingredient]),
  };
}

function totalsFrom(ingredients: SnapshotIngredient[]): NutrientTotals {
  return rollupRecipeTotals(
    ingredients.map((line) => ({
      quantityGrams: line.quantity,
      nutrientsPer100g: line.nutrientsPer100g,
    }))
  );
}

function nonEmptyOrNull(value: string | null | undefined): string | null {
  const trimmed = `${value ?? ""}`.trim();

  return trimmed.length > 0 ? trimmed : null;
}

function toFinite(value: number | string | null | undefined): number {
  const num = Number(value);

  return Number.isFinite(num) ? num : 0;
}
