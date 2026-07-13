import type { TrainerSession } from "@/lib/auth/session";
import type {
  AddIngredientInput,
  ReplaceIngredientSpec,
  UpdateIngredientInput,
} from "@/lib/nutrition/recipes/recipe-ingredient-service";
import type {
  RecipeCreateInput,
  RecipeListFilter,
  RecipeStatus,
  RecipeUpdateInput,
} from "@/lib/nutrition/recipes/recipe-service";

import { NextResponse } from "next/server";

import { getTrainerSession } from "@/lib/auth/session";
import { isNutritionV2TrainerEnabled } from "@/lib/nutrition/feature-flag";
import { pickNutrients } from "@/lib/nutrition/recipes/nutrient-snapshot";

const RECIPE_STATUSES: readonly RecipeStatus[] = [
  "draft",
  "active",
  "archived",
];

export function isRecipeStatus(value: unknown): value is RecipeStatus {
  return (
    typeof value === "string" &&
    (RECIPE_STATUSES as readonly string[]).includes(value)
  );
}

export type RecipeGuard =
  | { ok: true; session: TrainerSession; correlationId: string }
  | { ok: false; response: NextResponse };

/**
 * Trainer auth + nutrition-v2 flag gate. Order: auth (401 if no session) →
 * flag (404 if off, to hide existence). Returns the session on success.
 */
export async function guardRecipeRequest(): Promise<RecipeGuard> {
  const correlationId = `req-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const session = await getTrainerSession();

  if (session === null) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 401 }
      ),
    };
  }

  const enabled = await isNutritionV2TrainerEnabled(session.tenant_host);

  if (enabled === false) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: "No encontrado" },
        { status: 404 }
      ),
    };
  }

  return { ok: true, session, correlationId };
}

export function recipeNotFound(): NextResponse {
  return NextResponse.json(
    { success: false, error: "No encontrado" },
    { status: 404 }
  );
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

export function parseListFilter(params: URLSearchParams): RecipeListFilter {
  const filter: RecipeListFilter = {};
  const status = params.get("status");
  const tag = params.get("tag");
  const q = params.get("q");

  if (isRecipeStatus(status)) filter.status = status;
  if (tag !== null && tag.length > 0) filter.mealType = tag;
  if (q !== null && q.trim().length > 0) filter.query = q.trim();

  return filter;
}

export function parseCreateInput(
  body: unknown
): ParseResult<RecipeCreateInput> {
  const record = asRecord(body);
  const rawName = record?.["name"];
  const name = typeof rawName === "string" ? rawName.trim() : "";

  if (name.length === 0) {
    return { ok: false, error: "El nombre es obligatorio" };
  }

  const input: RecipeCreateInput = { name };

  applyShellFields(record, input);

  return { ok: true, value: input };
}

export function parseUpdateInput(
  body: unknown
): ParseResult<RecipeUpdateInput> {
  const record = asRecord(body);

  if (record === null) {
    return { ok: false, error: "Cuerpo de la petición inválido" };
  }

  const input: RecipeUpdateInput = {};

  if ("name" in record) {
    const rawName = record["name"];
    const name = typeof rawName === "string" ? rawName.trim() : "";

    if (name.length === 0) {
      return { ok: false, error: "El nombre no puede estar vacío" };
    }

    input.name = name;
  }

  applyShellFields(record, input);

  return { ok: true, value: input };
}

function applyShellFields(
  record: Record<string, unknown> | null,
  input: RecipeCreateInput | RecipeUpdateInput
): void {
  if (record === null) return;

  const description = record["description"];
  const instructions = record["instructions"];
  const tags = asStringArray(record["meal_type_tags"]);
  const prep = record["prep_time_min"];
  const cook = record["cook_time_min"];
  const status = record["status"];

  if (typeof description === "string") input.description = description;
  if (typeof instructions === "string") input.instructions = instructions;
  if (tags !== undefined) input.mealTypeTags = tags;
  if (typeof prep === "number") input.prepTimeMin = prep;
  if (typeof cook === "number") input.cookTimeMin = cook;
  if (isRecipeStatus(status)) input.status = status;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (
    typeof value === "object" &&
    value !== null &&
    Array.isArray(value) === false
  ) {
    return value as Record<string, unknown>;
  }

  return null;
}

function asStringArray(value: unknown): string[] | undefined {
  if (Array.isArray(value) === false) {
    return undefined;
  }

  return (value as unknown[]).filter((v): v is string => typeof v === "string");
}

export function parseAddIngredientInput(
  body: unknown
): ParseResult<AddIngredientInput> {
  const record = asRecord(body);

  if (record === null) {
    return { ok: false, error: "Cuerpo de la petición inválido" };
  }

  const quantity = record["quantity"];

  if (typeof quantity !== "number" || Number.isFinite(quantity) === false) {
    return { ok: false, error: "La cantidad es obligatoria" };
  }

  const rawIngredientId = record["ingredient_id"];
  const ingredientId =
    typeof rawIngredientId === "string" && rawIngredientId.length > 0
      ? rawIngredientId
      : undefined;
  const rawName = record["name"];
  const name = typeof rawName === "string" ? rawName.trim() : "";

  if (ingredientId === undefined && name.length === 0) {
    return { ok: false, error: "El nombre es obligatorio" };
  }

  const input: AddIngredientInput = { quantity };

  if (ingredientId !== undefined) input.ingredientId = ingredientId;
  if (name.length > 0) input.name = name;

  applyIngredientShellFields(record, input);

  return { ok: true, value: input };
}

export function parseUpdateIngredientInput(
  body: unknown
): ParseResult<UpdateIngredientInput> {
  const record = asRecord(body);

  if (record === null) {
    return { ok: false, error: "Cuerpo de la petición inválido" };
  }

  const quantity = record["quantity"];

  if (
    quantity !== undefined &&
    (typeof quantity !== "number" || Number.isFinite(quantity) === false)
  ) {
    return { ok: false, error: "La cantidad es inválida" };
  }

  const input: UpdateIngredientInput = {};

  if (typeof quantity === "number") input.quantity = quantity;

  const rawName = record["name"];

  if (typeof rawName === "string" && rawName.trim().length > 0) {
    input.name = rawName.trim();
  }

  applyIngredientShellFields(record, input);

  return { ok: true, value: input };
}

/**
 * Parse a full-replace body: `{ ingredients: [...] }`. Each line needs a finite
 * quantity; `id` marks an existing row, otherwise a `name` is required (a new
 * frozen line). An empty list is valid (clears the recipe). Rejects a
 * malformed body or any line with an invalid quantity / missing name.
 */
export function parseReplaceIngredientsInput(
  body: unknown
): ParseResult<ReplaceIngredientSpec[]> {
  const record = asRecord(body);
  const raw = record === null ? undefined : record["ingredients"];

  if (Array.isArray(raw) === false) {
    return { ok: false, error: "Lista de ingredientes inválida" };
  }

  const specs: ReplaceIngredientSpec[] = [];

  for (const item of raw as unknown[]) {
    const line = asRecord(item);

    if (line === null) {
      return { ok: false, error: "Ingrediente inválido" };
    }

    const quantity = line["quantity"];

    if (
      typeof quantity !== "number" ||
      Number.isFinite(quantity) === false ||
      quantity < 0
    ) {
      return { ok: false, error: "La cantidad debe ser un número ≥ 0" };
    }

    const spec: ReplaceIngredientSpec = { quantity };
    const rawId = line["id"];
    const id =
      typeof rawId === "string" && rawId.length > 0 ? rawId : undefined;
    const rawName = line["name"];
    const name = typeof rawName === "string" ? rawName.trim() : "";

    if (id === undefined && name.length === 0) {
      return { ok: false, error: "El nombre es obligatorio" };
    }

    if (id !== undefined) spec.id = id;
    if (name.length > 0) spec.name = name;

    const rawIngredientId = line["ingredient_id"];

    if (typeof rawIngredientId === "string" && rawIngredientId.length > 0) {
      spec.ingredientId = rawIngredientId;
    }

    const unit = line["unit"];
    const gramsPerUnit = line["grams_per_unit"];
    const nutrients = asRecord(line["nutrients_per_100g"]);
    const brand = line["brand"];
    const imageUrl = line["image_url"];

    if (typeof unit === "string" && unit.length > 0) spec.unit = unit;
    if (typeof gramsPerUnit === "number" && Number.isFinite(gramsPerUnit)) {
      spec.gramsPerUnit = gramsPerUnit;
    } else if (gramsPerUnit === null) {
      spec.gramsPerUnit = null;
    }
    if (nutrients !== null) spec.nutrientsPer100g = pickNutrients(nutrients);
    if (typeof brand === "string" && brand.length > 0) spec.brand = brand;
    if (typeof imageUrl === "string" && imageUrl.length > 0) {
      spec.imageUrl = imageUrl;
    }

    specs.push(spec);
  }

  return { ok: true, value: specs };
}

/** Parse a reorder body: `{ order: string[] }` of ingredient-row ids. */
export function parseReorderInput(body: unknown): ParseResult<string[]> {
  const record = asRecord(body);
  const order = record === null ? undefined : asStringArray(record["order"]);

  if (order === undefined || order.length === 0) {
    return { ok: false, error: "Orden inválido" };
  }

  return { ok: true, value: order };
}

function applyIngredientShellFields(
  record: Record<string, unknown>,
  input: AddIngredientInput | UpdateIngredientInput
): void {
  const unit = record["unit"];
  const gramsPerUnit = record["grams_per_unit"];
  const sortOrder = record["sort_order"];
  const nutrients = asRecord(record["nutrients_per_100g"]);
  const brand = record["brand"];
  const imageUrl = record["image_url"];

  if (typeof unit === "string" && unit.length > 0) input.unit = unit;
  // Grams-per-piece for unit="u"; explicit null clears it for g/ml/lt.
  if (typeof gramsPerUnit === "number" && Number.isFinite(gramsPerUnit)) {
    input.gramsPerUnit = gramsPerUnit;
  } else if (gramsPerUnit === null) {
    input.gramsPerUnit = null;
  }
  if (typeof sortOrder === "number") input.sortOrder = sortOrder;
  if (nutrients !== null) input.nutrientsPer100g = pickNutrients(nutrients);
  if (typeof brand === "string" && brand.length > 0) input.brand = brand;
  if (typeof imageUrl === "string" && imageUrl.length > 0) {
    input.imageUrl = imageUrl;
  }
}
