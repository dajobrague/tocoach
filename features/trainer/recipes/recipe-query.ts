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
  /** Every listed tag must be present (AND). */
  tags?: string[];
}

/**
 * Build the GET /api/recipes query string from filters. Maps query→q,
 * status→status, each tag→a repeated `tag` param, omitting empty values.
 * Returns "" when no filters are set (callers append it directly to the path).
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

  for (const tag of filters.tags ?? []) {
    const trimmed = tag.trim();

    if (trimmed.length > 0) params.append("tag", trimmed);
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

/** Distinct meal-type tags across a set of recipes, plus always-kept extras
 *  (the active filter selection, so it stays selectable). */
export function distinctMealTypes(
  recipes: RecipeListItem[],
  alwaysInclude: string[] = []
): string[] {
  const set = new Set<string>();

  for (const recipe of recipes) {
    for (const tag of recipe.meal_type_tags) {
      if (tag.length > 0) set.add(tag);
    }
  }

  for (const tag of alwaysInclude) {
    if (tag.length > 0) set.add(tag);
  }

  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

/**
 * Predictive tag input: existing tags containing `text` (minus the ones
 * already selected) and, when no existing tag equals the text, the trimmed
 * text as the "create new tag" candidate — null otherwise.
 */
export function tagSuggestions(
  existing: string[],
  selected: string[],
  text: string
): { matches: string[]; create: string | null } {
  const trimmed = text.trim();
  const needle = trimmed.toLowerCase();
  const taken = new Set(selected.map((tag) => tag.toLowerCase()));
  const matches = existing.filter(
    (tag) =>
      taken.has(tag.toLowerCase()) === false &&
      tag.toLowerCase().includes(needle)
  );
  const known =
    taken.has(needle) || existing.some((tag) => tag.toLowerCase() === needle);

  return { matches, create: needle.length > 0 && !known ? trimmed : null };
}
