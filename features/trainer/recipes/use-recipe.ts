"use client";

import type {
  FoodSearchResult,
  RecipeDetail,
  RecipeIngredientItem,
  RecipeMediaItem,
} from "./recipe-api";

import { useQuery } from "@tanstack/react-query";

import {
  fetchRecipe,
  fetchRecipeIngredients,
  fetchRecipeMedia,
  searchFoods,
} from "./recipe-api";

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
  const trimmed = query.trim();

  return useQuery<FoodSearchResult[]>({
    queryKey: ["food-search", trimmed],
    queryFn: () => searchFoods(trimmed),
    enabled: trimmed.length >= 2,
  });
}
