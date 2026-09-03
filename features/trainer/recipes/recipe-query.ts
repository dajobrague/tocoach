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

/**
 * Distinct tags for pickers (editor suggestions, library filter): ONE entry
 * per case-insensitive spelling. Which spelling wins — Sep 2 call, JC saw
 * "Cenas" and "cenas" listed twice:
 *   1. a folder with that name: the folder IS the tag, its casing rules;
 *   2. else the variant most recipes use;
 *   3. ties → first in code-unit order (not locale), so server and browser
 *      agree and the result is deterministic.
 * Folder names are always listed (a fresh, empty folder is still a valid
 * target); `extra` keeps entries selectable when no recipe carries them
 * anymore (the active filter).
 */
export function distinctMealTypes(
  recipes: RecipeListItem[],
  folderNames: string[] = [],
  extra: string[] = []
): string[] {
  const norm = (value: string) => value.trim().toLowerCase();
  // lowercased tag → usage count per exact spelling.
  const spellings = new Map<string, Map<string, number>>();
  const bump = (tag: string, by: number) => {
    const key = norm(tag);

    if (key.length === 0) return;
    const counts = spellings.get(key) ?? new Map<string, number>();

    counts.set(tag, (counts.get(tag) ?? 0) + by);
    spellings.set(key, counts);
  };

  for (const recipe of recipes) {
    for (const tag of recipe.meal_type_tags) bump(tag, 1);
  }
  for (const tag of [...folderNames, ...extra]) bump(tag, 0);

  const folderByKey = new Map(folderNames.map((name) => [norm(name), name]));

  return [...spellings.entries()]
    .map(([key, counts]) => {
      const mostUsed = [...counts.entries()].sort(
        (a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)
      )[0];

      return folderByKey.get(key) ?? mostUsed?.[0] ?? key;
    })
    .sort((a, b) => a.localeCompare(b));
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
