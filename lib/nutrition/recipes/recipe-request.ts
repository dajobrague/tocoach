import type { TrainerSession } from "@/lib/auth/session";
import type {
  RecipeCreateInput,
  RecipeListFilter,
  RecipeStatus,
  RecipeUpdateInput,
} from "@/lib/nutrition/recipes/recipe-service";

import { NextResponse } from "next/server";

import { getTrainerSession } from "@/lib/auth/session";
import { isNutritionV2Enabled } from "@/lib/nutrition/feature-flag";

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

  const enabled = await isNutritionV2Enabled(session.tenant_host);

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
