export type RecipeStatus = "draft" | "active" | "archived";

/** A recipe as surfaced in the trainer library list (subset of the API row). */
export interface RecipeListItem {
  id: string;
  name: string;
  status: RecipeStatus;
  meal_type_tags: string[];
  /** The one folder the recipe lives in; null = root. */
  folder_id: string | null;
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
