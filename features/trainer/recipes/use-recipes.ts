"use client";

import type { RecipeFilters, RecipeListItem } from "./recipe-query";

import { useQuery } from "@tanstack/react-query";

import { fetchRecipes } from "./recipe-query";

/** Read-only recipe library query, keyed on the active filters. */
export function useRecipes(filters: RecipeFilters) {
  return useQuery<RecipeListItem[]>({
    queryKey: [
      "recipes",
      filters.query ?? "",
      filters.status ?? "",
      filters.mealType ?? "",
    ],
    queryFn: () => fetchRecipes(filters),
  });
}
