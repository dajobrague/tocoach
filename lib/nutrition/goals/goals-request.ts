import type { NutritionGoals } from "./client-goals-service";
import type { GoalPresetInput } from "./goal-presets-service";
import type { ParseResult } from "@/lib/nutrition/recipes/recipe-request";

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

function isNonNegInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

/** Body for PUT /api/nutrition-goals: the four daily targets. */
export function parseNutritionGoals(
  body: unknown
): ParseResult<NutritionGoals> {
  const record = asRecord(body);

  if (record === null) {
    return { ok: false, error: "Cuerpo de la petición inválido" };
  }

  if (isNonNegInt(record.kcal) === false || record.kcal < 1) {
    return { ok: false, error: "kcal debe ser un entero positivo" };
  }

  for (const field of ["protein_g", "carbs_g", "fat_g"] as const) {
    if (isNonNegInt(record[field]) === false) {
      return { ok: false, error: `${field} debe ser un entero >= 0` };
    }
  }

  return {
    ok: true,
    value: {
      kcal: record.kcal,
      protein_g: record.protein_g as number,
      carbs_g: record.carbs_g as number,
      fat_g: record.fat_g as number,
    },
  };
}

/** Body for POST/PATCH goal presets: a name plus the four daily targets. */
export function parseGoalPreset(body: unknown): ParseResult<GoalPresetInput> {
  const record = asRecord(body);

  if (record === null) {
    return { ok: false, error: "Cuerpo de la petición inválido" };
  }

  const name = typeof record.name === "string" ? record.name.trim() : "";

  if (name.length === 0) {
    return { ok: false, error: "El nombre es obligatorio" };
  }

  const goals = parseNutritionGoals(body);

  if (goals.ok === false) {
    return goals;
  }

  return { ok: true, value: { name, ...goals.value } };
}
