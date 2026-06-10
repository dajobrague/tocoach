"use client";

import type {
  CycleSlot,
  CycleStatus,
  CycleSummary,
  CycleTree,
  OptionSelection,
  RecipeHit,
  FoodHit,
} from "./cycle-api";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  addOption,
  addSlot,
  createCycle,
  deleteOption,
  deleteSlot,
  fetchCycleTree,
  listCycles,
  searchFoods,
  searchRecipes,
  updateCycle,
  updateSlot,
} from "./cycle-api";

import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";

const cyclesKey = (clientId: number) => ["cycles", clientId] as const;
const treeKey = (cycleId: string) => ["cycle-tree", cycleId] as const;

/** Apply a slot patch to a cached slot row (snake_case columns). */
function applySlotPatch(
  slot: CycleSlot,
  patch: { position?: number; label?: string; dayIndex?: number }
): CycleSlot {
  return {
    ...slot,
    ...(patch.label !== undefined ? { label: patch.label } : {}),
    ...(patch.position !== undefined ? { position: patch.position } : {}),
    ...(patch.dayIndex !== undefined ? { day_index: patch.dayIndex } : {}),
  };
}

export function useClientCycles(clientId: number) {
  return useQuery<CycleSummary[]>({
    queryKey: cyclesKey(clientId),
    queryFn: () => listCycles(clientId),
  });
}

export function useCycleTree(cycleId: string | null) {
  return useQuery<CycleTree>({
    queryKey: treeKey(cycleId ?? "none"),
    queryFn: () => fetchCycleTree(cycleId as string),
    enabled: cycleId !== null,
  });
}

export function useCreateCycle(clientId: number) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      name: string;
      durationDays: number;
      startDate?: string;
    }) => createCycle({ clientId, ...input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: cyclesKey(clientId) }),
  });
}

export function useUpdateCycle(clientId: number, cycleId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (patch: {
      status?: CycleStatus;
      durationDays?: number;
      startDate?: string;
    }) => updateCycle(cycleId, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: cyclesKey(clientId) });
      qc.invalidateQueries({ queryKey: treeKey(cycleId) });
    },
  });
}

/** Slot + option mutations all invalidate the cycle tree they belong to. */
export function useCycleMutations(cycleId: string) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: treeKey(cycleId) });

  const addSlotM = useMutation({
    mutationFn: (input: {
      dayIndex: number;
      label?: string;
      position?: number;
    }) => addSlot(cycleId, input),
    onSuccess: invalidate,
  });
  const updateSlotM = useMutation({
    mutationFn: (vars: {
      slotId: string;
      patch: { position?: number; label?: string; dayIndex?: number };
    }) => updateSlot(cycleId, vars.slotId, vars.patch),
    // Optimistically apply the patch to the cached tree (e.g. inline relabel),
    // rolling back on error and reconciling with the server on settle.
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: treeKey(cycleId) });

      const previous = qc.getQueryData<CycleTree>(treeKey(cycleId));

      if (previous !== undefined) {
        qc.setQueryData<CycleTree>(treeKey(cycleId), {
          ...previous,
          slots: previous.slots.map((slot) =>
            slot.id === vars.slotId ? applySlotPatch(slot, vars.patch) : slot
          ),
        });
      }

      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous !== undefined) {
        qc.setQueryData(treeKey(cycleId), context.previous);
      }
    },
    onSettled: invalidate,
  });
  const deleteSlotM = useMutation({
    mutationFn: (slotId: string) => deleteSlot(cycleId, slotId),
    onSuccess: invalidate,
  });
  const addOptionM = useMutation({
    mutationFn: (vars: { slotId: string; selection: OptionSelection }) =>
      addOption(cycleId, vars.slotId, vars.selection),
    onSuccess: invalidate,
  });
  const deleteOptionM = useMutation({
    mutationFn: (vars: { slotId: string; optionId: string }) =>
      deleteOption(cycleId, vars.slotId, vars.optionId),
    onSuccess: invalidate,
  });

  return { addSlotM, updateSlotM, deleteSlotM, addOptionM, deleteOptionM };
}

export function useRecipeSearch(query: string) {
  return useQuery<RecipeHit[]>({
    queryKey: ["cycle-recipe-search", query],
    queryFn: () => searchRecipes(query),
    enabled: query.trim().length > 0,
  });
}

export function useFoodSearch(query: string) {
  // Debounce so a request fires per pause, not per keystroke (OFF rate-limits),
  // and keep the previous results on screen while the next page loads.
  const debounced = useDebouncedValue(query.trim(), 300);

  return useQuery<FoodHit[]>({
    queryKey: ["cycle-food-search", debounced],
    queryFn: () => searchFoods(debounced),
    enabled: debounced.length >= 2,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}
