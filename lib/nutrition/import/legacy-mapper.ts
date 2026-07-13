import type {
  CandidateIngredient,
  LegacyIngredientRow,
  LegacyMealOptionInput,
  LegacyStatedMacros,
  RecipeCandidate,
} from "./types";
import type { NutrientsPer100g } from "@/lib/nutrition/food-source";

/**
 * Pure, best-effort mapping from legacy `nutrition_*` rows to review-ready
 * recipe candidates. Never throws on a malformed row.
 *
 * Grounded in the PRODUCTION data shape (profiled 2026-07-13):
 * - 0 of 4,273 legacy ingredient rows carry macros; 935 of 945 options carry
 *   them as option-level totals. So when no line has its own macros, the
 *   option's stated totals are DISTRIBUTED across the lines (uniform density,
 *   weighted by effective grams) — the imported recipe's computed total then
 *   equals the old plan's stated total exactly. Lines are flagged `estimated`.
 * - Quantities are free text ("200gr", "2 unidades", "al gusto", ""). Gram
 *   and millilitre amounts map 1:1, kilo/litre ×1000, and unidad/pieza lines
 *   become real "u" lines with the editor's 100 g piece-weight convention
 *   (legacy never stored one; the trainer corrects it after import).
 * - Options with stated macros but NO ingredient rows (37 in production) get
 *   a single whole-dish line instead of being silently dropped.
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
const PIECE_UNITS = new Set([
  "u",
  "ud",
  "uds",
  "un",
  "und",
  "unds",
  "unidad",
  "unidades",
  "pieza",
  "piezas",
  "pza",
  "pzas",
  "unit",
  "units",
  "piece",
  "pieces",
]);

/** Editor convention for a piece weight nobody recorded (see ingredient-row). */
const DEFAULT_PIECE_GRAMS = 100;

/** Name for the synthetic line of an option that had no ingredient rows. */
const WHOLE_DISH_LINE = "Plato completo (del plan anterior)";

/** Generic placeholder names the legacy UI auto-assigned (e.g. "Opción 1"). */
const GENERIC_NAME = /^opci[oó]n\s*\d+$/i;

/** A parsed legacy quantity: pieces for "u", grams otherwise. */
export interface ParsedQuantity {
  amount: number;
  unit: "g" | "u";
}

export function parseQuantity(
  quantity: string | null | undefined,
  unit: string | null | undefined
): ParsedQuantity | undefined {
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

  if (PIECE_UNITS.has(token)) {
    return { amount: round(value), unit: "u" };
  }

  if (KG_UNITS.has(token) || LITRE_UNITS.has(token)) {
    return { amount: round(value * 1000), unit: "g" };
  }

  // Grams, millilitres, bare numbers, and unknown units: treated 1:1.
  return { amount: round(value), unit: "g" };
}

/** Kept for callers/tests that only need the gram reading of a quantity. */
export function parseQuantityToGrams(
  quantity: string | null | undefined,
  unit: string | null | undefined
): number | undefined {
  const parsed = parseQuantity(quantity, unit);

  if (parsed === undefined) {
    return undefined;
  }

  return parsed.unit === "u"
    ? round(parsed.amount * DEFAULT_PIECE_GRAMS)
    : parsed.amount;
}

export function toRecipeCandidate(
  input: LegacyMealOptionInput
): RecipeCandidate | null {
  const option = input.option ?? ({} as LegacyMealOptionInput["option"]);
  const rows = Array.isArray(input.ingredients) ? input.ingredients : [];

  const name = resolveName(option.name, input.mealLabel);

  if (name === null) {
    return null;
  }

  const statedMacros = resolveStatedMacros(option);
  let ingredients = rows
    .map(toCandidateIngredient)
    .filter((line): line is CandidateIngredient => line !== null);

  // An option with stated totals but no ingredient rows (37 in production) is
  // still a real dish — represent it as one whole-dish line instead of
  // dropping it invisibly.
  if (ingredients.length === 0 && statedMacros !== undefined) {
    ingredients = [wholeDishLine(statedMacros)];
  }

  if (ingredients.length === 0) {
    return null;
  }

  const hasOwnLineMacros = ingredients.some(
    (line) => line.nutrients !== undefined && line.estimated !== true
  );
  const distributed =
    hasOwnLineMacros === false && statedMacros !== undefined
      ? distributeStatedMacros(ingredients, statedMacros)
      : ingredients;

  const candidate: RecipeCandidate = {
    legacyOptionId: option.id,
    name,
    ingredients: distributed,
    macrosSource: hasOwnLineMacros
      ? "lines"
      : statedMacros !== undefined
        ? "stated"
        : "none",
  };

  const steps = resolveSteps(option.instructions, option.recipe_notes);

  if (steps !== undefined) {
    candidate.steps = steps;
  }

  if (statedMacros !== undefined) {
    candidate.legacyStatedMacros = statedMacros;
  }

  return candidate;
}

/**
 * Spread the option's stated totals over the lines so the recipe's computed
 * total equals the stated total exactly:
 *
 * - Weighted by each line's effective grams (pieces × 100 g for "u" lines),
 *   i.e. a uniform-density assumption — the same per-100g profile on every
 *   weighted line. Amount-less lines ("al gusto") get no share.
 * - When NO line has a usable amount, the whole total lands on the first line
 *   as 1 piece × 100 g, so nothing is lost and the trainer has one obvious
 *   place to refine.
 *
 * Pure — returns new line objects; every touched line is flagged `estimated`.
 */
export function distributeStatedMacros(
  lines: CandidateIngredient[],
  stated: LegacyStatedMacros
): CandidateIngredient[] {
  const totalGrams = lines.reduce((sum, line) => sum + effectiveGrams(line), 0);

  if (totalGrams <= 0) {
    return lines.map((line, index) =>
      index === 0
        ? {
            ...line,
            amount: 1,
            unit: "u",
            gramsPerUnit: DEFAULT_PIECE_GRAMS,
            nutrients: statedAsPer100g(stated, DEFAULT_PIECE_GRAMS),
            estimated: true,
          }
        : { ...line }
    );
  }

  // Same density everywhere: per-100g = stated ÷ totalGrams × 100.
  const per100 = statedAsPer100g(stated, totalGrams);

  return lines.map((line) =>
    effectiveGrams(line) > 0
      ? { ...line, nutrients: per100, estimated: true }
      : { ...line }
  );
}

/** Grams this line will weigh in the v2 editor (u → pieces × piece weight). */
function effectiveGrams(line: CandidateIngredient): number {
  if (line.amount === undefined || line.amount <= 0) {
    return 0;
  }

  return line.unit === "u"
    ? line.amount * (line.gramsPerUnit ?? DEFAULT_PIECE_GRAMS)
    : line.amount;
}

/** Stated totals expressed as per-100g of `grams` total weight. */
function statedAsPer100g(
  stated: LegacyStatedMacros,
  grams: number
): Partial<NutrientsPer100g> {
  const factor = 100 / grams;
  const nutrients: Partial<NutrientsPer100g> = {};

  scaleInto(nutrients, "kcal", stated.kcal, factor);
  scaleInto(nutrients, "protein_g", stated.protein_g, factor);
  scaleInto(nutrients, "carbs_g", stated.carbs_g, factor);
  scaleInto(nutrients, "fat_g", stated.fat_g, factor);

  return nutrients;
}

function wholeDishLine(stated: LegacyStatedMacros): CandidateIngredient {
  return {
    name: WHOLE_DISH_LINE,
    amount: 1,
    unit: "u",
    gramsPerUnit: DEFAULT_PIECE_GRAMS,
    nutrients: statedAsPer100g(stated, DEFAULT_PIECE_GRAMS),
    estimated: true,
  };
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
): LegacyStatedMacros | undefined {
  const macros: LegacyStatedMacros = {};

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
  const parsed = parseQuantity(row.quantity, row.unit);

  if (parsed !== undefined) {
    line.amount = parsed.amount;
    line.unit = parsed.unit;

    if (parsed.unit === "u") {
      line.gramsPerUnit = DEFAULT_PIECE_GRAMS;
    }

    // Per-line macros — the ideal path, kept for the rare/future rows that
    // have them (production currently has none).
    const nutrients = perQuantityToPer100g(row, effectiveGrams(line));

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

  scaleInto(nutrients, "kcal", row.calories, factor);
  scaleInto(nutrients, "protein_g", row.protein, factor);
  scaleInto(nutrients, "carbs_g", row.carbs, factor);
  scaleInto(nutrients, "fat_g", row.fats, factor);

  return Object.keys(nutrients).length > 0 ? nutrients : undefined;
}

function scaleInto(
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
