import type { NutrientsPer100g } from "@/lib/nutrition/food-source";

/**
 * Types for the guided legacy-nutrition importer (P2-T1 / P2-T2).
 *
 * The `Legacy*Row` shapes mirror the *old* `nutrition_*` schema verbatim — the
 * importer only ever reads those tables, never writes them. A legacy
 * `nutrition_meal_options` row is the unit that maps to one library recipe; its
 * ingredient lines come from `nutrition_ingredients` (linked by `option_id`).
 */

/** Subset of a legacy `nutrition_meal_options` row the importer reads. */
export interface LegacyMealOptionRow {
  id: string;
  name: string | null;
  option_order: number | null;
  instructions: string | null;
  recipe_notes: string | null;
  prep_time_minutes: number | null;
  cooking_time_minutes: number | null;
  servings: number | null;
  /** Option-level macro totals (per the whole option), often null. */
  protein: number | null;
  carbs: number | null;
  fats: number | null;
  calories: number | null;
}

/** Subset of a legacy `nutrition_ingredients` row the importer reads. */
export interface LegacyIngredientRow {
  id: string;
  option_id: string | null;
  name: string | null;
  /** Free text, often unit-embedded ("200gr", "15ml"). */
  quantity: string | null;
  unit: string | null;
  ingredient_order: number | null;
  /** Per-quantity macro contribution of this line, usually null in legacy data. */
  protein: number | null;
  carbs: number | null;
  fats: number | null;
  calories: number | null;
}

/** One legacy option plus its ingredient lines and optional parent meal label. */
export interface LegacyMealOptionInput {
  option: LegacyMealOptionRow;
  ingredients: LegacyIngredientRow[];
  /** Parent `nutrition_meals.label`, used to enrich generic option names. */
  mealLabel?: string | null;
}

/** A normalized ingredient line of a recipe candidate. */
export interface CandidateIngredient {
  name: string;
  /** Best-effort grams; absent when the legacy quantity had no number. */
  grams?: number;
  /** Per-100g nutrients; absent when the legacy line had no usable macros. */
  nutrients?: Partial<NutrientsPer100g>;
}

/** A recipe created by an import run. */
export interface ImportCreatedRecipe {
  legacyOptionId: string;
  recipeId: string;
  name: string;
}

/** A candidate skipped during an import run, with the reason. */
export interface ImportSkippedCandidate {
  legacyOptionId: string;
  name: string;
  reason: "duplicate" | "not_found";
}

/** Outcome of approving a set of candidates for import. */
export interface ImportResult {
  created: ImportCreatedRecipe[];
  skipped: ImportSkippedCandidate[];
}

/**
 * The macro totals the trainer originally stated on the legacy meal option,
 * read verbatim from `nutrition_meal_options`. Display-only: it documents what
 * the old plan claimed and is NEVER used to set the imported recipe's computed
 * macros (those come from the ingredient snapshots via recompute).
 */
export type LegacyStatedMacros = Partial<
  Pick<NutrientsPer100g, "kcal" | "protein_g" | "carbs_g" | "fat_g">
>;

/** A best-effort recipe ready for trainer review before import. */
export interface RecipeCandidate {
  /** Source `nutrition_meal_options.id` — traceability + idempotency key. */
  legacyOptionId: string;
  name: string;
  ingredients: CandidateIngredient[];
  /** Combined instructions + recipe notes, when present. */
  steps?: string;
  /** What the old plan stated for this option (display-only — see type docs). */
  legacyStatedMacros?: LegacyStatedMacros;
}
