import type { ParseResult } from "@/lib/nutrition/recipes/recipe-request";

/**
 * Parse + validate the POST /api/recipes/import/approve body.
 *
 * Contract: `{ optionIds: string[] }` — the legacy `nutrition_meal_options` ids
 * the trainer approved for import. Returns the de-duplicated, non-empty id list,
 * or a 400-worthy error. The ids only *select* which server-derived candidates
 * to import (see RecipeImportService), so no recipe content is trusted here.
 */
export function parseApproveInput(body: unknown): ParseResult<string[]> {
  if (
    typeof body !== "object" ||
    body === null ||
    Array.isArray(body) === true
  ) {
    return { ok: false, error: "Cuerpo de la petición inválido" };
  }

  const raw = (body as Record<string, unknown>)["optionIds"];

  if (Array.isArray(raw) === false) {
    return { ok: false, error: "Se requiere optionIds" };
  }

  const ids = Array.from(
    new Set(
      (raw as unknown[])
        .filter((id): id is string => typeof id === "string")
        .map((id) => id.trim())
        .filter((id) => id.length > 0)
    )
  );

  if (ids.length === 0) {
    return { ok: false, error: "Se requiere al menos un elemento aprobado" };
  }

  return { ok: true, value: ids };
}
