"use client";

import type { QueryClient } from "@tanstack/react-query";
import type { AddFromFoodArgs, RecipeFormValues } from "./recipe-api";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  addIngredientFromFood,
  createRecipe,
  removeIngredient,
  removeMedia,
  updateIngredient,
  updateRecipe,
  uploadMedia,
} from "./recipe-api";

/** Invalidate everything that depends on a recipe's content. */
function invalidateRecipe(client: QueryClient, recipeId: string): void {
  client.invalidateQueries({ queryKey: ["recipe", recipeId] });
  client.invalidateQueries({ queryKey: ["recipe-ingredients", recipeId] });
  client.invalidateQueries({ queryKey: ["recipe-media", recipeId] });
  client.invalidateQueries({ queryKey: ["recipes"] });
}

export function useCreateRecipe() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (values: RecipeFormValues) => createRecipe(values),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["recipes"] });
    },
  });
}

export function useUpdateRecipe(recipeId: string) {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (values: RecipeFormValues) => updateRecipe(recipeId, values),
    onSuccess: () => invalidateRecipe(client, recipeId),
  });
}

export function useAddIngredient(recipeId: string) {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (args: AddFromFoodArgs) =>
      addIngredientFromFood(recipeId, args),
    onSuccess: () => invalidateRecipe(client, recipeId),
  });
}

export function useUpdateIngredient(recipeId: string) {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (args: {
      ingredientRowId: string;
      quantity?: number;
      unit?: string;
    }) => {
      const patch: { quantity?: number; unit?: string } = {};

      if (args.quantity !== undefined) patch.quantity = args.quantity;
      if (args.unit !== undefined) patch.unit = args.unit;

      return updateIngredient(recipeId, args.ingredientRowId, patch);
    },
    onSuccess: () => invalidateRecipe(client, recipeId),
  });
}

export function useRemoveIngredient(recipeId: string) {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (ingredientRowId: string) =>
      removeIngredient(recipeId, ingredientRowId),
    onSuccess: () => invalidateRecipe(client, recipeId),
  });
}

export function useUploadMedia(recipeId: string) {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (args: {
      file: File;
      orientation?: "vertical" | "horizontal";
    }) => uploadMedia(recipeId, args.file, args.orientation),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["recipe-media", recipeId] });
    },
  });
}

export function useRemoveMedia(recipeId: string) {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (mediaId: string) => removeMedia(recipeId, mediaId),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["recipe-media", recipeId] });
    },
  });
}
