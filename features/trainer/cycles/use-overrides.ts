"use client";

import type {
  ClientActivity,
  OverrideFormInput,
  OverrideRow,
} from "./overrides-api";
import type { MealCycleTree } from "@/lib/nutrition/cycles/meal-cycle-service";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createOverride,
  deleteOverride,
  fetchClientActivity,
  fetchCycleTreeFull,
  listOverrides,
} from "./overrides-api";

const overridesKey = (cycleId: string) => ["cycle-overrides", cycleId] as const;
const fullTreeKey = (cycleId: string) => ["cycle-tree-full", cycleId] as const;
const activityKey = (cycleId: string, from: string, to: string) =>
  ["cycle-client-activity", cycleId, from, to] as const;

/** The full cycle tree (server shape) for resolving the calendar. */
export function useCycleTreeFull(cycleId: string | null) {
  return useQuery<MealCycleTree>({
    queryKey: fullTreeKey(cycleId ?? "none"),
    queryFn: () => fetchCycleTreeFull(cycleId as string),
    enabled: cycleId !== null,
  });
}

/** The client's menu choices in [from, to] + standing alternative picks. */
export function useClientActivity(
  cycleId: string | null,
  from: string,
  to: string
) {
  return useQuery<ClientActivity>({
    queryKey: activityKey(cycleId ?? "none", from, to),
    queryFn: () => fetchClientActivity(cycleId as string, from, to),
    enabled: cycleId !== null && from.length > 0 && to.length > 0,
  });
}

export function useOverrides(cycleId: string | null) {
  return useQuery<OverrideRow[]>({
    queryKey: overridesKey(cycleId ?? "none"),
    queryFn: () => listOverrides(cycleId as string),
    enabled: cycleId !== null,
  });
}

/** Create/delete overrides; both invalidate the cycle's override list. */
export function useOverrideMutations(cycleId: string) {
  const qc = useQueryClient();
  const invalidate = () =>
    qc.invalidateQueries({ queryKey: overridesKey(cycleId) });

  const createM = useMutation({
    mutationFn: (input: OverrideFormInput) => createOverride(cycleId, input),
    onSuccess: invalidate,
  });
  const deleteM = useMutation({
    mutationFn: (overrideId: string) => deleteOverride(cycleId, overrideId),
    onSuccess: invalidate,
  });

  return { createM, deleteM };
}
