export type RecipeStatus = "draft" | "active" | "archived";

/** A recipe as surfaced in the trainer library list (subset of the API row). */
export interface RecipeListItem {
  id: string;
  name: string;
  status: RecipeStatus;
  meal_type_tags: string[];
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  /** Optional cover thumbnail; the list API does not return media yet. */
  thumbnailUrl?: string | null;
}

export interface RecipeFilters {
  query?: string;
  status?: RecipeStatus;
  mealType?: string;
}

/**
 * Build the GET /api/recipes query string from filters. Maps query→q,
 * status→status, mealType→tag, omitting empty values. Returns "" when no
 * filters are set (callers append it directly to the path).
 */
export function buildRecipesQuery(filters: RecipeFilters): string {
  const params = new URLSearchParams();
  const query = filters.query?.trim();

  if (query !== undefined && query.length > 0) {
    params.set("q", query);
  }

  if (filters.status !== undefined) {
    params.set("status", filters.status);
  }

  const mealType = filters.mealType?.trim();

  if (mealType !== undefined && mealType.length > 0) {
    params.set("tag", mealType);
  }

  const qs = params.toString();

  return qs.length > 0 ? `?${qs}` : "";
}

export async function fetchRecipes(
  filters: RecipeFilters
): Promise<RecipeListItem[]> {
  const response = await fetch(`/api/recipes${buildRecipesQuery(filters)}`, {
    credentials: "same-origin",
    cache: "no-store",
  });

  if (response.ok === false) {
    throw new Error("No se pudieron cargar las recetas");
  }

  const data = await response.json();

  if (data?.success !== true) {
    throw new Error(data?.error ?? "Error al cargar recetas");
  }

  return (data.data ?? []) as RecipeListItem[];
}

/** Distinct meal-type tags across a set of recipes, plus an always-kept extra. */
export function distinctMealTypes(
  recipes: RecipeListItem[],
  alwaysInclude?: string
): string[] {
  const set = new Set<string>();

  for (const recipe of recipes) {
    for (const tag of recipe.meal_type_tags) {
      if (tag.length > 0) set.add(tag);
    }
  }

  if (alwaysInclude !== undefined && alwaysInclude.length > 0) {
    set.add(alwaysInclude);
  }

  return Array.from(set).sort((a, b) => a.localeCompare(b));
}
