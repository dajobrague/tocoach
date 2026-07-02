import type { NutrientsPer100g } from "@/lib/nutrition/food-source";
import type { NutrientTotals } from "@/lib/nutrition/recipes/macro-rollup";

import { rollupRecipeTotals } from "@/lib/nutrition/recipes/macro-rollup";
import { pickNutrients } from "@/lib/nutrition/recipes/nutrient-snapshot";
import { toGrams } from "@/lib/nutrition/recipes/unit-conversion";

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
  /** Amount of this line, expressed in {@link unit} (e.g. 2 for "2 u"). */
  quantity: number;
  unit: string;
  /** Weight of one piece, in grams — only meaningful when `unit === "u"`. */
  gramsPerUnit: number | null;
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
    /** Weight of one piece, in grams — only meaningful when `unit === "u"`. */
    gramsPerUnit: number | null;
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
  /** Product thumbnail (e.g. Open Food Facts) frozen with the option; null/absent
   *  when the food has no image. It's an external URL, so freezing it is safe. */
  imageUrl?: string | null;
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

/**
 * Return a copy of `snapshot` with per-client portions applied: `quantities[i]`
 * (in ingredient `i`'s own unit — e.g. pieces for `u`, grams for `g`) overrides
 * ingredient `i` when finite; missing/NaN entries keep the existing quantity.
 * The line's `unit`/`gramsPerUnit` are never changed — only the amount. Totals
 * are recomputed (unit-aware) from the result. Pure — the input snapshot is
 * never mutated. Used to set portions when a dish is assigned to a client, and
 * to edit them afterwards, without touching the recipe library.
 */
export function applyPortions(
  snapshot: OptionSnapshot,
  quantities: number[]
): OptionSnapshot {
  const ingredients: SnapshotIngredient[] = snapshot.ingredients.map(
    (line, i) => {
      const override = quantities[i];

      // Only non-negative finite amounts; a negative portion is never valid.
      return typeof override === "number" &&
        Number.isFinite(override) &&
        override >= 0
        ? { ...line, quantity: override }
        : { ...line };
    }
  );

  return { ...snapshot, ingredients, totals: totalsFrom(ingredients) };
}

/**
 * Return a copy of `snapshot` with its photos/videos replaced by the recipe's
 * *current* library media, keeping every frozen field (name, steps, ingredients,
 * quantities, totals) untouched. Images are treated as cosmetic and tracked
 * live; nutrition stays frozen (§4.1). Only recipe snapshots are overlaid, and
 * only when `liveMedia` is non-empty — a food option, a deleted recipe, or a
 * recipe with no media is returned unchanged (the frozen media is the fallback).
 * Pure: the input snapshot is never mutated.
 */
export function overlayLiveMedia(
  snapshot: OptionSnapshot,
  liveMedia: SnapshotMedia[]
): OptionSnapshot {
  if (snapshot.sourceType !== "recipe" || liveMedia.length === 0) {
    return snapshot;
  }

  const media: SnapshotMedia[] = liveMedia.map((item) => ({
    type: item.type,
    url: item.url,
    orientation: item.orientation,
  }));
  const images: SnapshotImage[] = media
    .filter((item) => item.type === "image")
    .map((item) => ({ url: item.url, orientation: item.orientation }));

  return { ...snapshot, images, media };
}

function buildRecipeSnapshot(recipe: RecipeSnapshotInput): OptionSnapshot {
  const ingredients: SnapshotIngredient[] = recipe.ingredients.map((line) => ({
    name: `${line.name ?? ""}`,
    quantity: toFinite(line.quantity),
    unit: line.unit !== null && line.unit !== undefined ? line.unit : "g",
    gramsPerUnit: gramsPerUnitOrNull(line.gramsPerUnit),
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
    gramsPerUnit: null,
    nutrientsPer100g: pickNutrients(food.nutrientsPer100g),
  };

  const url =
    typeof food.imageUrl === "string" && food.imageUrl.length > 0
      ? food.imageUrl
      : null;
  const media: SnapshotMedia[] =
    url !== null ? [{ type: "image", url, orientation: null }] : [];
  const images: SnapshotImage[] = media.map((item) => ({
    url: item.url,
    orientation: item.orientation,
  }));

  return {
    sourceType: "food",
    sourceRefId: food.id,
    name: food.name,
    steps: null,
    images,
    media,
    ingredients: [ingredient],
    totals: totalsFrom([ingredient]),
  };
}

function totalsFrom(ingredients: SnapshotIngredient[]): NutrientTotals {
  return rollupRecipeTotals(
    ingredients.map((line) => ({
      quantityGrams: toGrams(line.quantity, line.unit, line.gramsPerUnit),
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

/** Keep a positive finite grams-per-piece; anything else (missing/NaN/≤0) → null. */
function gramsPerUnitOrNull(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : null;
}
