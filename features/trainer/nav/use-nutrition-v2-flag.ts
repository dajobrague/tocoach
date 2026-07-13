"use client";

import { useQuery } from "@tanstack/react-query";

/** Both sides of the nutrition-v2 flag (see /api/nutrition/flag). */
export interface NutritionV2Flags {
  /** Client-facing cutover: what the tenant's CLIENTS experience. */
  enabled: boolean;
  /** Trainer tools (prepare phase); always true when `enabled` is. */
  trainerEnabled: boolean;
}

async function fetchNutritionV2Flags(): Promise<NutritionV2Flags> {
  const response = await fetch("/api/nutrition/flag", {
    credentials: "same-origin",
    cache: "no-store",
  });

  if (response.ok === false) {
    return { enabled: false, trainerEnabled: false };
  }

  const data = await response.json();

  return {
    enabled: data?.enabled === true,
    trainerEnabled: data?.trainerEnabled === true,
  };
}

/**
 * Full flag status incl. loading, for callers that must not flash the
 * flagged-off UI while resolving (nav, banners, tab switches). Defaults to
 * all-false until resolved. `prepareMode` = trainer tools on while clients
 * are still on legacy (the migration window).
 */
export function useNutritionV2FlagStatus(): {
  enabled: boolean;
  trainerEnabled: boolean;
  prepareMode: boolean;
  isLoading: boolean;
} {
  const { data, isPending } = useQuery({
    queryKey: ["nutrition-v2-flag"],
    queryFn: fetchNutritionV2Flags,
    staleTime: 5 * 60 * 1000,
  });

  const enabled = data?.enabled === true;
  const trainerEnabled = data?.trainerEnabled === true;

  return {
    enabled,
    trainerEnabled,
    prepareMode: trainerEnabled && enabled === false,
    isLoading: isPending,
  };
}
