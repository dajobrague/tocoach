"use client";

import type { QueryClient } from "@tanstack/react-query";
import type {
  AddFromFoodArgs,
  ManualIngredientInput,
  RecipeFormValues,
  RecipeIngredientItem,
} from "./recipe-api";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  addIngredientFromFood,
  addIngredientManual,
  createRecipe,
  resolveNativeAdd,
  deleteRecipe,
  removeIngredient,
  removeMedia,
  replaceIngredients,
  reorderIngredients,
  updateIngredient,
  updateRecipe,
  uploadMedia,
} from "./recipe-api";

/** A search-result add or a manual free-text add — both via the same mutation. */
export type AddIngredientArgs =
  | { kind: "food"; food: AddFromFoodArgs["food"]; quantity: number }
  | { kind: "manual"; input: ManualIngredientInput };

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

export function useDeleteRecipe() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (recipeId: string) => deleteRecipe(recipeId),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["recipes"] });
    },
  });
}

export function useAddIngredient(recipeId: string) {
  const client = useQueryClient();

  return useMutation({
    mutationFn: async (args: AddIngredientArgs) => {
      if (args.kind === "manual") {
        return addIngredientManual(recipeId, args.input);
      }

      // Land the food in its native unit when OFF knows one: a beverage as
      // its serving in ml, a solid with a serving weight as 1 u × that
      // weight; otherwise the caller's plain-grams default.
      const native = await resolveNativeAdd(args.food);

      return addIngredientFromFood(recipeId, {
        food: args.food,
        quantity: native?.quantity ?? args.quantity,
        ...(native !== null ? { unit: native.unit } : {}),
        ...(native?.gramsPerUnit !== undefined
          ? { gramsPerUnit: native.gramsPerUnit }
          : {}),
      });
    },
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
      gramsPerUnit?: number | null;
    }) => {
      const patch: {
        quantity?: number;
        unit?: string;
        gramsPerUnit?: number | null;
      } = {};

      if (args.quantity !== undefined) patch.quantity = args.quantity;
      if (args.unit !== undefined) patch.unit = args.unit;
      if (args.gramsPerUnit !== undefined)
        patch.gramsPerUnit = args.gramsPerUnit;

      return updateIngredient(recipeId, args.ingredientRowId, patch);
    },
    onSuccess: () => invalidateRecipe(client, recipeId),
  });
}

const INGREDIENTS_KEY = (recipeId: string) =>
  ["recipe-ingredients", recipeId] as const;

/**
 * Reorder ingredient lines with an optimistic cache update so the list settles
 * instantly and never snaps back mid-drag. On error we roll back to the
 * pre-drag snapshot; on settle we refetch to reconcile server sort_order.
 */
export function useReorderIngredients(recipeId: string) {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (orderedIds: string[]) =>
      reorderIngredients(recipeId, orderedIds),
    onMutate: async (orderedIds: string[]) => {
      const key = INGREDIENTS_KEY(recipeId);

      await client.cancelQueries({ queryKey: key });
      const previous = client.getQueryData<RecipeIngredientItem[]>(key) ?? [];
      const byId = new Map(previous.map((item) => [item.id, item]));
      const next = orderedIds
        .map((id) => byId.get(id))
        .filter((item): item is RecipeIngredientItem => item !== undefined);

      client.setQueryData<RecipeIngredientItem[]>(key, next);

      return { previous };
    },
    onError: (_error, _orderedIds, context) => {
      if (context !== undefined) {
        client.setQueryData(INGREDIENTS_KEY(recipeId), context.previous);
      }
    },
    onSettled: () => {
      client.invalidateQueries({ queryKey: INGREDIENTS_KEY(recipeId) });
      client.invalidateQueries({ queryKey: ["recipes"] });
    },
  });
}

/** Persist the whole buffered ingredient list at once (the editor's save). */
export function useReplaceIngredients(recipeId: string) {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (body: { ingredients: Record<string, unknown>[] }) =>
      replaceIngredients(recipeId, body),
    onSuccess: (rows) => {
      client.setQueryData(["recipe-ingredients", recipeId], rows);
      client.invalidateQueries({ queryKey: ["recipe", recipeId] });
      client.invalidateQueries({ queryKey: ["recipes"] });
    },
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
    // Media edits change the recipe's thumbnail too, so invalidate the recipe
    // and the recipes list (not just recipe-media) — otherwise the picker keeps
    // a stale thumbnailUrl pointing at the now-deleted storage object (404).
    onSuccess: () => invalidateRecipe(client, recipeId),
  });
}

export function useRemoveMedia(recipeId: string) {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (mediaId: string) => removeMedia(recipeId, mediaId),
    onSuccess: () => invalidateRecipe(client, recipeId),
  });
}
