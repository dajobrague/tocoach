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
  /** Amount in {@link unit} — grams for "g" (ml 1:1, kg/l ×1000), pieces for
   *  "u". Absent when the legacy quantity had no number ("al gusto"). */
  amount?: number;
  /** "g" (default) or "u" for unidad/pieza legacy lines. */
  unit?: "g" | "u";
  /** Piece weight for "u" lines. Legacy never stored one, so imports seed the
   *  editor's 100 g convention; the trainer corrects it after import. */
  gramsPerUnit?: number;
  /** Per-100g nutrients; absent when nothing usable existed for the line. */
  nutrients?: Partial<NutrientsPer100g>;
  /** True when {@link nutrients} was distributed from the option's stated
   *  totals (uniform density) rather than read from the line itself. */
  estimated?: boolean;
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
 * read verbatim from `nutrition_meal_options`.
 *
 * In production this is the ONLY nutrition data that exists (all 4,273 legacy
 * ingredient rows carry null macros), so when no line has its own macros these
 * totals are distributed across the lines (uniform density, weighted by
 * grams) — making the imported recipe's computed total exactly match what the
 * old plan stated. Lines built this way are flagged `estimated`.
 */
export type LegacyStatedMacros = Partial<
  Pick<NutrientsPer100g, "kcal" | "protein_g" | "carbs_g" | "fat_g">
>;

/** Where a candidate's nutrition came from (drives the review-card labels). */
export type CandidateMacroSource =
  /** Per-line macros existed on the legacy ingredients (rare/ideal). */
  | "lines"
  /** Distributed from the option's stated totals (the production norm). */
  | "stated"
  /** Nothing usable anywhere — the recipe imports macro-less. */
  | "none";

/** A best-effort recipe ready for trainer review before import. */
export interface RecipeCandidate {
  /** Source `nutrition_meal_options.id` — traceability + idempotency key. */
  legacyOptionId: string;
  name: string;
  ingredients: CandidateIngredient[];
  macrosSource: CandidateMacroSource;
  /** Combined instructions + recipe notes, when present. */
  steps?: string;
  /** What the old plan stated for this option, verbatim (for the review card). */
  legacyStatedMacros?: LegacyStatedMacros;
}
