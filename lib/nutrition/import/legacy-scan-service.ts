import type {
  LegacyIngredientRow,
  LegacyMealOptionRow,
  RecipeCandidate,
} from "./types";
import type { SupabaseClient } from "@supabase/supabase-js";

import { toRecipeCandidate } from "./legacy-mapper";

const MEALS_TABLE = "nutrition_meals";
const INGREDIENTS_TABLE = "nutrition_ingredients";
const OPTION_FIELDS =
  "id, name, option_order, instructions, recipe_notes, prep_time_minutes, cooking_time_minutes, servings, protein, carbs, fats, calories";
const PAGE_SIZE = 1000;

/** A `nutrition_meals` row with its embedded option rows. */
interface MealWithOptions {
  id: string;
  label: string | null;
  nutrition_meal_options: LegacyMealOptionRow[] | null;
}

/**
 * Read-only scan of a trainer's legacy `nutrition_*` data.
 *
 * Tenant scoping: `nutrition_meals` and `nutrition_ingredients` carry
 * `tenant_host`, so every query filters on it — one tenant can never see
 * another's legacy data. `nutrition_meal_options` has no `tenant_host`, so it is
 * reached only by embedding under its tenant-scoped parent meal. This service
 * NEVER writes to a legacy table. The Supabase client is injected for testing.
 */
export class LegacyNutritionScanService {
  private readonly client: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  /** Return every importable recipe candidate for the tenant (junk skipped). */
  async scan(tenantHost: string): Promise<RecipeCandidate[]> {
    const [meals, ingredients] = await Promise.all([
      this.fetchMeals(tenantHost),
      this.fetchIngredients(tenantHost),
    ]);

    const byOption = groupByOption(ingredients);
    const candidates: RecipeCandidate[] = [];

    for (const meal of sortMeals(meals)) {
      const options = [...(meal.nutrition_meal_options ?? [])].sort(
        (a, b) => (a.option_order ?? 0) - (b.option_order ?? 0)
      );

      for (const option of options) {
        const candidate = toRecipeCandidate({
          option,
          ingredients: byOption.get(option.id) ?? [],
          mealLabel: meal.label,
        });

        if (candidate !== null) {
          candidates.push(candidate);
        }
      }
    }

    return candidates;
  }

  private async fetchMeals(tenantHost: string): Promise<MealWithOptions[]> {
    const out: MealWithOptions[] = [];

    for (let page = 0; ; page += 1) {
      const from = page * PAGE_SIZE;
      const { data, error } = await this.client
        .from(MEALS_TABLE)
        .select(`id, label, nutrition_meal_options(${OPTION_FIELDS})`)
        .eq("tenant_host", tenantHost)
        .order("id", { ascending: true })
        .range(from, from + PAGE_SIZE - 1);

      if (error !== null) {
        throw new Error(
          `LegacyNutritionScanService.scan meals: ${error.message}`
        );
      }

      const rows = (data ?? []) as unknown as MealWithOptions[];

      out.push(...rows);

      if (rows.length < PAGE_SIZE) {
        break;
      }
    }

    return out;
  }

  private async fetchIngredients(
    tenantHost: string
  ): Promise<LegacyIngredientRow[]> {
    const out: LegacyIngredientRow[] = [];

    for (let page = 0; ; page += 1) {
      const from = page * PAGE_SIZE;
      const { data, error } = await this.client
        .from(INGREDIENTS_TABLE)
        .select(
          "id, option_id, name, quantity, unit, ingredient_order, protein, carbs, fats, calories"
        )
        .eq("tenant_host", tenantHost)
        .order("ingredient_order", { ascending: true })
        .range(from, from + PAGE_SIZE - 1);

      if (error !== null) {
        throw new Error(
          `LegacyNutritionScanService.scan ingredients: ${error.message}`
        );
      }

      const rows = (data ?? []) as LegacyIngredientRow[];

      out.push(...rows);

      if (rows.length < PAGE_SIZE) {
        break;
      }
    }

    return out;
  }
}

function groupByOption(
  ingredients: LegacyIngredientRow[]
): Map<string, LegacyIngredientRow[]> {
  const map = new Map<string, LegacyIngredientRow[]>();

  for (const row of ingredients) {
    if (row.option_id === null) {
      continue;
    }

    const list = map.get(row.option_id) ?? [];

    list.push(row);
    map.set(row.option_id, list);
  }

  for (const list of map.values()) {
    list.sort((a, b) => (a.ingredient_order ?? 0) - (b.ingredient_order ?? 0));
  }

  return map;
}

function sortMeals(meals: MealWithOptions[]): MealWithOptions[] {
  return [...meals].sort((a, b) => {
    const labelA = `${a.label ?? ""}`;
    const labelB = `${b.label ?? ""}`;

    return labelA.localeCompare(labelB) || a.id.localeCompare(b.id);
  });
}
