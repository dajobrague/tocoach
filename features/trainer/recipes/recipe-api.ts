import type { RecipeStatus } from "./recipe-query";

/**
 * Transitional default quantity (grams) for library ingredients.
 *
 * Recipes are portion-free: per-client quantities are set when a dish is
 * assigned. The authoring UI no longer collects a quantity, but the add path,
 * macro recompute, and assignment snapshot still expect one — so we submit this
 * neutral default to keep them working unchanged. Phase 2 (per-client portions
 * at assignment) removes it and makes the column nullable.
 */
export const LIBRARY_DEFAULT_QUANTITY = 100;

// ─── Client-side API shapes ─────────────────────────────────────────────────

export interface RecipeFormValues {
  name: string;
  description: string;
  instructions: string;
  mealTypeTags: string[];
  status: RecipeStatus;
}

export interface RecipeDetail {
  id: string;
  name: string;
  description: string | null;
  instructions: string | null;
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
}

export interface RecipeIngredientItem {
  id: string;
  ingredient_id: string | null;
  name_snapshot: string;
  /** Frozen brand for display; null for unbranded/raw/manual lines. */
  brand: string | null;
  /** Frozen product thumbnail URL; null when none. */
  image_url: string | null;
  /** Frozen per-100g nutrients (kcal etc.) for reference display. */
  nutrient_snapshot: Record<string, number>;
  quantity: number;
  unit: string;
  /** Grams per piece when unit="u"; null for g/ml/lt. */
  grams_per_unit: number | null;
  sort_order: number;
}

export interface RecipeMediaItem {
  id: string;
  type: "image" | "video";
  url: string;
  orientation: "vertical" | "horizontal" | null;
  sort_order: number;
}

export interface FoodSearchResult {
  source: "off" | "manual" | "seed";
  sourceRef: string | null;
  name: string;
  brand?: string;
  /** Optional product thumbnail URL (Open Food Facts); absent when none. */
  imageUrl?: string;
  defaultUnit: "g";
  nutrientsPer100g: Record<string, number>;
}

// ─── Pure payload builders (unit-tested) ────────────────────────────────────

/** Recipe create/update body: trimmed name + tags + status; optional text. */
export function buildRecipePayload(
  values: RecipeFormValues
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    name: values.name.trim(),
    meal_type_tags: values.mealTypeTags,
    status: values.status,
  };
  const description = values.description.trim();
  const instructions = values.instructions.trim();

  if (description.length > 0) payload.description = description;
  if (instructions.length > 0) payload.instructions = instructions;

  return payload;
}

export interface AddFromFoodArgs {
  food: FoodSearchResult;
  quantity: number;
  unit?: string;
}

/**
 * Add-ingredient body built from a food search result. The search API does not
 * surface the ingredients-cache row id, so we freeze the snapshot directly via
 * the free-text path (name + per-100g nutrients) — equivalent to what the cache
 * would store.
 */
export function buildAddFromFoodPayload(
  args: AddFromFoodArgs
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    name: args.food.name,
    quantity: args.quantity,
    unit: args.unit ?? args.food.defaultUnit ?? "g",
    nutrients_per_100g: args.food.nutrientsPer100g,
  };

  // Freeze brand + image alongside the name so the library list can show what
  // the ingredient is beyond its name. Omitted when the food has neither.
  if (args.food.brand !== undefined) payload.brand = args.food.brand;
  if (args.food.imageUrl !== undefined) payload.image_url = args.food.imageUrl;

  return payload;
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

export interface ManualIngredientInput {
  name: string;
  /** Quantity in grams. */
  quantity: number;
  /** Raw per-100g values keyed by nutrient (strings from inputs are coerced). */
  nutrients: Record<string, unknown>;
}

/**
 * Add-ingredient body for a manual entry. Reuses the free-text path: trimmed
 * name, unit 'g', and the 8 per-100g nutrients coerced to finite numbers
 * (missing/NaN → 0). For now manual entries attach to the recipe as a frozen
 * free-text line (caching for cross-recipe reuse is a fast-follow).
 */
export function buildAddManualPayload(
  input: ManualIngredientInput
): Record<string, unknown> {
  const nutrients: Record<string, number> = {};

  for (const key of MANUAL_NUTRIENT_KEYS) {
    const value = Number(input.nutrients[key]);

    nutrients[key] = Number.isFinite(value) ? value : 0;
  }

  return {
    name: input.name.trim(),
    quantity: input.quantity,
    unit: "g",
    nutrients_per_100g: nutrients,
  };
}

export function buildUpdateIngredientPayload(patch: {
  quantity?: number;
  unit?: string;
  gramsPerUnit?: number | null;
}): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  if (patch.quantity !== undefined) out.quantity = patch.quantity;
  if (patch.unit !== undefined) out.unit = patch.unit;
  // null is meaningful — it clears grams-per-piece when switching off "u".
  if (patch.gramsPerUnit !== undefined) out.grams_per_unit = patch.gramsPerUnit;

  return out;
}

export function buildMediaFormData(
  file: File,
  orientation?: "vertical" | "horizontal"
): FormData {
  const form = new FormData();

  form.set("file", file);

  if (orientation !== undefined) {
    form.set("orientation", orientation);
  }

  return form;
}

// ─── Fetchers ───────────────────────────────────────────────────────────────

async function readData<T>(response: Response): Promise<T> {
  const data = await response.json();

  if (data?.success !== true) {
    throw new Error(data?.error ?? "Error de red");
  }

  return data.data as T;
}

async function sendJson<T>(
  url: string,
  method: "POST" | "PATCH" | "PUT",
  body: Record<string, unknown>
): Promise<T> {
  const response = await fetch(url, {
    method,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  return readData<T>(response);
}

async function getData<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    credentials: "same-origin",
    cache: "no-store",
  });

  return readData<T>(response);
}

export function createRecipe(values: RecipeFormValues): Promise<RecipeDetail> {
  return sendJson<RecipeDetail>(
    "/api/recipes",
    "POST",
    buildRecipePayload(values)
  );
}

export function updateRecipe(
  recipeId: string,
  values: RecipeFormValues
): Promise<RecipeDetail> {
  return sendJson<RecipeDetail>(
    `/api/recipes/${recipeId}`,
    "PATCH",
    buildRecipePayload(values)
  );
}

export function fetchRecipe(recipeId: string): Promise<RecipeDetail> {
  return getData<RecipeDetail>(`/api/recipes/${recipeId}`);
}

/** Soft-deletes (archives) a recipe so it leaves the library. */
export async function deleteRecipe(recipeId: string): Promise<void> {
  const response = await fetch(`/api/recipes/${recipeId}`, {
    method: "DELETE",
    credentials: "same-origin",
  });

  await readData<unknown>(response);
}

export function fetchRecipeIngredients(
  recipeId: string
): Promise<RecipeIngredientItem[]> {
  return getData<RecipeIngredientItem[]>(
    `/api/recipes/${recipeId}/ingredients`
  );
}

export function fetchRecipeMedia(recipeId: string): Promise<RecipeMediaItem[]> {
  return getData<RecipeMediaItem[]>(`/api/recipes/${recipeId}/media`);
}

export function searchFoods(
  query: string,
  brand?: string
): Promise<FoodSearchResult[]> {
  const params = new URLSearchParams({ q: query });
  const trimmedBrand = brand?.trim() ?? "";

  if (trimmedBrand.length > 0) {
    params.set("brand", trimmedBrand);
  }

  return getData<FoodSearchResult[]>(`/api/foods/search?${params.toString()}`);
}

export function addIngredientFromFood(
  recipeId: string,
  args: AddFromFoodArgs
): Promise<RecipeIngredientItem> {
  return sendJson<RecipeIngredientItem>(
    `/api/recipes/${recipeId}/ingredients`,
    "POST",
    buildAddFromFoodPayload(args)
  );
}

export function addIngredientManual(
  recipeId: string,
  input: ManualIngredientInput
): Promise<RecipeIngredientItem> {
  return sendJson<RecipeIngredientItem>(
    `/api/recipes/${recipeId}/ingredients`,
    "POST",
    buildAddManualPayload(input)
  );
}

export function updateIngredient(
  recipeId: string,
  ingredientRowId: string,
  patch: { quantity?: number; unit?: string; gramsPerUnit?: number | null }
): Promise<RecipeIngredientItem> {
  return sendJson<RecipeIngredientItem>(
    `/api/recipes/${recipeId}/ingredients/${ingredientRowId}`,
    "PATCH",
    buildUpdateIngredientPayload(patch)
  );
}

/** Persist a new ingredient order; returns the re-ordered list. */
export function reorderIngredients(
  recipeId: string,
  orderedIds: string[]
): Promise<RecipeIngredientItem[]> {
  return sendJson<RecipeIngredientItem[]>(
    `/api/recipes/${recipeId}/ingredients/reorder`,
    "PATCH",
    { order: orderedIds }
  );
}

/** Replace the whole ingredient list in one call (the editor's explicit save). */
export function replaceIngredients(
  recipeId: string,
  body: { ingredients: Record<string, unknown>[] }
): Promise<RecipeIngredientItem[]> {
  return sendJson<RecipeIngredientItem[]>(
    `/api/recipes/${recipeId}/ingredients`,
    "PUT",
    body
  );
}

export async function removeIngredient(
  recipeId: string,
  ingredientRowId: string
): Promise<void> {
  const response = await fetch(
    `/api/recipes/${recipeId}/ingredients/${ingredientRowId}`,
    { method: "DELETE", credentials: "same-origin" }
  );

  await readData<unknown>(response);
}

export async function uploadMedia(
  recipeId: string,
  file: File,
  orientation?: "vertical" | "horizontal"
): Promise<RecipeMediaItem> {
  const response = await fetch(`/api/recipes/${recipeId}/media`, {
    method: "POST",
    credentials: "same-origin",
    body: buildMediaFormData(file, orientation),
  });

  return readData<RecipeMediaItem>(response);
}

export async function removeMedia(
  recipeId: string,
  mediaId: string
): Promise<void> {
  const response = await fetch(
    `/api/recipes/${recipeId}/media?mediaId=${encodeURIComponent(mediaId)}`,
    { method: "DELETE", credentials: "same-origin" }
  );

  await readData<unknown>(response);
}
