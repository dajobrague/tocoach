/**
 * Reshape helpers for the nutrition plan tree coming out of PostgREST embedded
 * selects.
 *
 * Background: the client endpoint (`/api/client/nutrition`) and the trainer
 * endpoint (`/api/nutrition/plans/[id]`) both used to fetch the tree as 4
 * nested Promise.all loops (87+ queries per plan). Fase 2 replaces that with a
 * single Supabase query using nested embeds. The raw shape that PostgREST
 * returns looks like:
 *
 *   {
 *     ...plan columns,
 *     nutrition_days: [
 *       {
 *         ...day columns,
 *         nutrition_meals: [
 *           {
 *             ...meal columns,
 *             nutrition_meal_options: [
 *               {
 *                 ...option columns,
 *                 nutrition_ingredients: [ ...ingredient rows ]
 *               }
 *             ]
 *           }
 *         ]
 *       }
 *     ]
 *   }
 *
 * The frontend (both trainer UI and client-facing UI) expects a very specific
 * shape with different key names and some field-level defaults:
 *
 *   {
 *     ...plan columns,
 *     (plan_mode / pdf_url / pdf_name / show_meal_images defaults: client only)
 *     days: [
 *       {
 *         ...day columns,
 *         meals: [
 *           {
 *             ...meal columns,
 *             image_url: (col ?? null),      // client only
 *             has_alternatives: (col ?? false),
 *             options: [
 *               { ...option columns, ingredients: [ ...sorted by ingredient_order ] }
 *             ],
 *             ingredients: [ ...flattened across options in option_order then ingredient_order ]
 *           }
 *         ]
 *       }
 *     ]
 *   }
 *
 * This module owns that exact transformation. The ordering is preserved by
 * having the Supabase query apply `.order()` at every level, so the transform
 * is a pure rename + flatten + coerce pass, with no sorting.
 *
 * Two variants exist:
 *  - "client":   applies the extra defaults on the plan (plan_mode, pdf_url,
 *                pdf_name, show_meal_images) and on meals (image_url). This
 *                matches the pre-Fase-2 behaviour of /api/client/nutrition.
 *  - "trainer":  preserves the pre-Fase-2 behaviour of /api/nutrition/plans/[id]
 *                which did NOT apply those defaults — it returned the raw
 *                columns untouched at the plan and meal.image_url level.
 *
 * Keeping the two variants explicit avoids accidentally harmonising subtly
 * different endpoints and breaking a UI that relies on the older behaviour.
 */

// The raw types are intentionally permissive (index signatures + `unknown`):
// Supabase's generated types don't know the shape of the embedded nested rows
// and we don't want to invent a parallel type graph. The reshape function is
// the single place that turns `unknown` data into a concrete shape.

type RawIngredient = { [key: string]: unknown };

type RawOption = {
  [key: string]: unknown;
  nutrition_ingredients?: RawIngredient[] | null;
};

type RawMeal = {
  [key: string]: unknown;
  image_url?: unknown;
  has_alternatives?: unknown;
  nutrition_meal_options?: RawOption[] | null;
};

type RawDay = {
  [key: string]: unknown;
  nutrition_meals?: RawMeal[] | null;
};

export type RawNutritionPlan = {
  [key: string]: unknown;
  plan_mode?: unknown;
  pdf_url?: unknown;
  pdf_name?: unknown;
  show_meal_images?: unknown;
  nutrition_days?: RawDay[] | null;
};

export type NutritionTreeVariant = "client" | "trainer";

function asArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

/**
 * Reshape a single raw plan row (as returned by the PostgREST embedded select)
 * into the exact shape the frontend expects. See the module-level comment for
 * the full shape contract.
 */
export function reshapeNutritionPlan(
  rawPlan: RawNutritionPlan,
  variant: NutritionTreeVariant
): Record<string, unknown> {
  const {
    nutrition_days: rawDays,
    // The following keys only exist when variant is "client"; they are read so
    // we can fall back to defaults without letting them leak into planRest.
    plan_mode,
    pdf_url,
    pdf_name,
    show_meal_images,
    ...planRest
  } = rawPlan;

  const days = asArray(rawDays).map((rawDay) => {
    const { nutrition_meals: rawMeals, ...dayRest } = rawDay;

    const meals = asArray(rawMeals).map((rawMeal) => {
      const {
        nutrition_meal_options: rawOptions,
        image_url,
        has_alternatives,
        ...mealRest
      } = rawMeal;

      const options = asArray(rawOptions).map((rawOpt) => {
        const { nutrition_ingredients: rawIngredients, ...optRest } = rawOpt;

        return {
          ...optRest,
          ingredients: asArray(rawIngredients),
        };
      });

      // Flat list of ingredients for the meal, preserving the (option_order,
      // ingredient_order) traversal that the old Promise.all code produced.
      const ingredients = options.flatMap((opt) => opt.ingredients);

      const mealBase = {
        ...mealRest,
        has_alternatives: has_alternatives ?? false,
        options,
        ingredients,
      };

      if (variant === "client") {
        return {
          ...mealBase,
          image_url: image_url ?? null,
        };
      }

      // Trainer variant preserves image_url as-is (matches pre-Fase-2 shape).
      return {
        ...mealBase,
        image_url,
      };
    });

    return { ...dayRest, meals };
  });

  if (variant === "client") {
    return {
      ...planRest,
      plan_mode: plan_mode ?? "structured",
      pdf_url: pdf_url ?? null,
      pdf_name: pdf_name ?? null,
      show_meal_images: show_meal_images !== false,
      days,
    };
  }

  // Trainer variant: preserve the plan columns untouched (matches pre-Fase-2
  // shape of /api/nutrition/plans/[id]).
  return {
    ...planRest,
    plan_mode,
    pdf_url,
    pdf_name,
    show_meal_images,
    days,
  };
}

/**
 * Select string used by both endpoints to fetch the full nutrition tree in a
 * single query. The FK hint `!fk_ingredient_option` disambiguates the path
 * between nutrition_ingredients and nutrition_meal_options (ingredients also
 * has a legacy FK to nutrition_meals via nutrition_meal_id; we never want
 * PostgREST to pick that one).
 */
export const NUTRITION_TREE_SELECT = `
  *,
  nutrition_days (
    *,
    nutrition_meals (
      *,
      nutrition_meal_options (
        *,
        nutrition_ingredients!fk_ingredient_option (*)
      )
    )
  )
`;
