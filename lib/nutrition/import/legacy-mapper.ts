import type {
  CandidateIngredient,
  LegacyIngredientRow,
  LegacyMealOptionInput,
  RecipeCandidate,
} from "./types";
import type { NutrientsPer100g } from "@/lib/nutrition/food-source";

/**
 * Pure, best-effort mapping from legacy `nutrition_*` rows to review-ready
 * recipe candidates. Never throws on a malformed row: junk/empty options return
 * `null` (the caller skips them) and unusable ingredient lines are dropped.
 *
 * Quantity handling: legacy quantities are free text with the unit usually
 * embedded ("200gr", "15ml"). {@link parseQuantityToGrams} normalizes to grams
 * best-effort — gram/millilitre/bare/unknown units are treated 1:1 and
 * kilo/litre units are scaled ×1000. The trainer reviews every candidate before
 * import, so an over-eager guess is corrected, never silently trusted.
 */

const KG_UNITS = new Set([
  "kg",
  "kgs",
  "kilo",
  "kilos",
  "kilogramo",
  "kilogramos",
]);
const LITRE_UNITS = new Set(["l", "lt", "lts", "litro", "litros"]);

/** Generic placeholder names the legacy UI auto-assigned (e.g. "Opción 1"). */
const GENERIC_NAME = /^opci[oó]n\s*\d+$/i;

export function parseQuantityToGrams(
  quantity: string | null | undefined,
  unit: string | null | undefined
): number | undefined {
  const text = `${quantity ?? ""}`.trim().toLowerCase();
  const match = text.match(/-?\d+(?:[.,]\d+)?/);

  if (match === null) {
    return undefined;
  }

  const value = Number(match[0].replace(",", "."));

  if (Number.isFinite(value) === false || value <= 0) {
    return undefined;
  }

  // Prefer an explicit unit column; otherwise read the suffix after the number.
  const rawUnit =
    unit !== null && unit !== undefined && unit.trim().length > 0
      ? unit
      : text.slice((match.index ?? 0) + match[0].length);
  const token = rawUnit.toLowerCase().replace(/[^a-záéíóúü]/g, "");

  if (KG_UNITS.has(token) || LITRE_UNITS.has(token)) {
    return round(value * 1000);
  }

  // Grams, millilitres, bare numbers, and unknown units: treated 1:1.
  return round(value);
}

export function toRecipeCandidate(
  input: LegacyMealOptionInput
): RecipeCandidate | null {
  const option = input.option ?? ({} as LegacyMealOptionInput["option"]);
  const rows = Array.isArray(input.ingredients) ? input.ingredients : [];

  const name = resolveName(option.name, input.mealLabel);
  const ingredients = rows
    .map(toCandidateIngredient)
    .filter((line): line is CandidateIngredient => line !== null);

  if (name === null || ingredients.length === 0) {
    return null;
  }

  const candidate: RecipeCandidate = {
    legacyOptionId: option.id,
    name,
    ingredients,
  };

  const steps = resolveSteps(option.instructions, option.recipe_notes);

  if (steps !== undefined) {
    candidate.steps = steps;
  }

  const statedMacros = resolveStatedMacros(option);

  if (statedMacros !== undefined) {
    candidate.legacyStatedMacros = statedMacros;
  }

  return candidate;
}

/**
 * Build a usable recipe name. A meaningful option name wins; a generic
 * placeholder ("Opción 1") is prefixed with the parent meal label; an empty
 * name falls back to the meal label. Returns `null` when nothing usable exists.
 */
function resolveName(
  optionName: string | null | undefined,
  mealLabel: string | null | undefined
): string | null {
  const name = `${optionName ?? ""}`.trim();
  const label = `${mealLabel ?? ""}`.trim();

  if (name.length === 0) {
    return label.length > 0 ? label : null;
  }

  if (GENERIC_NAME.test(name) && label.length > 0) {
    return `${label} — ${name}`;
  }

  return name;
}

function resolveSteps(
  instructions: string | null | undefined,
  notes: string | null | undefined
): string | undefined {
  const parts = [instructions, notes]
    .map((part) => `${part ?? ""}`.trim())
    .filter((part) => part.length > 0);

  return parts.length > 0 ? parts.join("\n\n") : undefined;
}

function resolveStatedMacros(
  option: LegacyMealOptionInput["option"]
): RecipeCandidate["legacyStatedMacros"] | undefined {
  const macros: NonNullable<RecipeCandidate["legacyStatedMacros"]> = {};

  assignFinite(macros, "kcal", option.calories);
  assignFinite(macros, "protein_g", option.protein);
  assignFinite(macros, "carbs_g", option.carbs);
  assignFinite(macros, "fat_g", option.fats);

  return Object.keys(macros).length > 0 ? macros : undefined;
}

function toCandidateIngredient(
  row: LegacyIngredientRow | null | undefined
): CandidateIngredient | null {
  if (row === null || row === undefined) {
    return null;
  }

  const name = `${row.name ?? ""}`.trim();

  if (name.length === 0) {
    return null;
  }

  const line: CandidateIngredient = { name };
  const grams = parseQuantityToGrams(row.quantity, row.unit);

  if (grams !== undefined) {
    line.grams = grams;

    const nutrients = perQuantityToPer100g(row, grams);

    if (nutrients !== undefined) {
      line.nutrients = nutrients;
    }
  }

  return line;
}

/**
 * Convert a legacy line's per-quantity macro contribution to a per-100g
 * snapshot (`per100 = total / grams * 100`). Only the 4 macros legacy stores
 * (calories, protein, carbs, fats) are mapped; the rest stay absent. Returns
 * `undefined` when no macro is usable.
 */
function perQuantityToPer100g(
  row: LegacyIngredientRow,
  grams: number
): Partial<NutrientsPer100g> | undefined {
  if (grams <= 0) {
    return undefined;
  }

  const factor = 100 / grams;
  const nutrients: Partial<NutrientsPer100g> = {};

  scalePer100g(nutrients, "kcal", row.calories, factor);
  scalePer100g(nutrients, "protein_g", row.protein, factor);
  scalePer100g(nutrients, "carbs_g", row.carbs, factor);
  scalePer100g(nutrients, "fat_g", row.fats, factor);

  return Object.keys(nutrients).length > 0 ? nutrients : undefined;
}

function scalePer100g(
  target: Partial<NutrientsPer100g>,
  key: keyof NutrientsPer100g,
  total: number | null | undefined,
  factor: number
): void {
  if (total === null || total === undefined) {
    return;
  }

  const value = Number(total);

  if (Number.isFinite(value)) {
    target[key] = round(value * factor);
  }
}

function assignFinite(
  target: Record<string, number>,
  key: string,
  value: number | null | undefined
): void {
  if (value === null || value === undefined) {
    return;
  }

  const num = Number(value);

  if (Number.isFinite(num)) {
    target[key] = num;
  }
}

/** Round to 4 decimals to avoid float noise while keeping precision. */
function round(value: number): number {
  return Math.round(value * 10000) / 10000;
}
