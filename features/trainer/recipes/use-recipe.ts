"use client";

import type {
  FoodSearchResult,
  RecipeDetail,
  RecipeIngredientItem,
  RecipeMediaItem,
} from "./recipe-api";

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import {
  fetchRecipe,
  fetchRecipeIngredients,
  fetchRecipeMedia,
  searchFoods,
} from "./recipe-api";

import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";

export function useRecipe(recipeId: string) {
  return useQuery<RecipeDetail>({
    queryKey: ["recipe", recipeId],
    queryFn: () => fetchRecipe(recipeId),
    enabled: recipeId.length > 0,
  });
}

export function useRecipeIngredients(recipeId: string) {
  return useQuery<RecipeIngredientItem[]>({
    queryKey: ["recipe-ingredients", recipeId],
    queryFn: () => fetchRecipeIngredients(recipeId),
    enabled: recipeId.length > 0,
  });
}

export function useRecipeMedia(recipeId: string) {
  return useQuery<RecipeMediaItem[]>({
    queryKey: ["recipe-media", recipeId],
    queryFn: () => fetchRecipeMedia(recipeId),
    enabled: recipeId.length > 0,
  });
}

export function useFoodSearch(query: string) {
  // Debounce so a request fires per pause, not per keystroke (OFF rate-limits),
  // and keep the previous results on screen while the next page loads.
  const debounced = useDebouncedValue(query.trim(), 300);

  return useQuery<FoodSearchResult[]>({
    queryKey: ["food-search", debounced],
    queryFn: () => searchFoods(debounced),
    enabled: debounced.length >= 2,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}
