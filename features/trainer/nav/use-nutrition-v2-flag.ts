"use client";

import { useQuery } from "@tanstack/react-query";

async function fetchNutritionV2Flag(): Promise<boolean> {
  const response = await fetch("/api/nutrition/flag", {
    credentials: "same-origin",
    cache: "no-store",
  });

  if (response.ok === false) {
    return false;
  }

  const data = await response.json();

  return data?.enabled === true;
}

/**
 * Whether nutrition-v2 is enabled for the current trainer's tenant. Defaults to
 * `false` until resolved, so flagged-off UI never flashes.
 */
export function useNutritionV2Enabled(): boolean {
  const { data } = useQuery({
    queryKey: ["nutrition-v2-flag"],
    queryFn: fetchNutritionV2Flag,
    staleTime: 5 * 60 * 1000,
  });

  return data === true;
}
