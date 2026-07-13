"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  fetchReadiness,
  postFlagAction,
  type NutritionUpdateAction,
} from "./readiness-api";

const READINESS_KEY = ["nutrition-update-readiness"] as const;

export function useNutritionUpdateReadiness() {
  return useQuery({
    queryKey: READINESS_KEY,
    queryFn: fetchReadiness,
  });
}

/** Flip a wizard flag transition and refresh everything that reads flags. */
export function useNutritionUpdateAction() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (action: NutritionUpdateAction) => postFlagAction(action),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: READINESS_KEY });
      // The nav + Nutrición tab share this key (see use-nutrition-v2-flag).
      client.invalidateQueries({ queryKey: ["nutrition-v2-flag"] });
    },
  });
}
