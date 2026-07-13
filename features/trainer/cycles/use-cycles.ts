"use client";

import type {
  CycleSlot,
  CycleStatus,
  CycleSummary,
  CycleTree,
  GoalPreset,
  NutritionGoals,
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
  addDay,
  addOption,
  addSlot,
  assignDayTarget,
  copyDay,
  createCycle,
  createGoalPreset,
  dayReorderMapping,
  deleteGoalPreset,
  deleteOption,
  deleteSlot,
  fetchClientGoals,
  fetchCycleTree,
  listCycles,
  listGoalPresets,
  removeDay,
  renameDay,
  reorderDay,
  saveClientGoals,
  searchFoods,
  searchRecipes,
  updateCycle,
  updateGoalPreset,
  updateOptionIngredients,
  updateOptionPortions,
  updateSlot,
  type OptionIngredientEdit,
} from "./cycle-api";

import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";

const cyclesKey = (clientId: number) => ["cycles", clientId] as const;
const treeKey = (cycleId: string) => ["cycle-tree", cycleId] as const;
const goalsKey = (clientId: number) => ["client-goals", clientId] as const;
const presetsKey = (clientId: number) => ["goal-presets", clientId] as const;

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

export function useClientGoals(clientId: number) {
  return useQuery<NutritionGoals | null>({
    queryKey: goalsKey(clientId),
    queryFn: () => fetchClientGoals(clientId),
  });
}

export function useSaveClientGoals(clientId: number) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (goals: NutritionGoals) => saveClientGoals(clientId, goals),
    onSuccess: (saved) => qc.setQueryData(goalsKey(clientId), saved),
  });
}

export function useGoalPresets(clientId: number) {
  return useQuery<GoalPreset[]>({
    queryKey: presetsKey(clientId),
    queryFn: () => listGoalPresets(clientId),
  });
}

/** Create/update/delete a client's named goal presets. */
export function useGoalPresetMutations(clientId: number) {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: presetsKey(clientId) });
  };

  const createM = useMutation({
    mutationFn: (input: { name: string } & NutritionGoals) =>
      createGoalPreset(clientId, input),
    onSuccess: invalidate,
  });
  const updateM = useMutation({
    mutationFn: (vars: {
      presetId: string;
      input: { name: string } & NutritionGoals;
    }) => updateGoalPreset(vars.presetId, vars.input),
    onSuccess: invalidate,
  });
  const deleteM = useMutation({
    mutationFn: (presetId: string) => deleteGoalPreset(presetId),
    onSuccess: invalidate,
  });

  return { createM, updateM, deleteM };
}

/** Name/clear one day of the plan; patches the cached tree in place. */
export function useRenameDay(cycleId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (vars: { dayIndex: number; name: string }) =>
      renameDay(cycleId, vars.dayIndex, vars.name),
    onSuccess: (result) => {
      const previous = qc.getQueryData<CycleTree>(treeKey(cycleId));

      if (previous !== undefined) {
        qc.setQueryData<CycleTree>(treeKey(cycleId), {
          ...previous,
          day_names: result.day_names,
        });
      }
    },
  });
}

/** Assign/clear one day's goal preset; refreshes the cycle tree. */
export function useAssignDayTarget(cycleId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (vars: { dayIndex: number; presetId: string | null }) =>
      assignDayTarget(cycleId, vars.dayIndex, vars.presetId),
    // Patch the cached tree's day_targets right away so the progress bars
    // re-measure without waiting for the refetch.
    onSuccess: (result) => {
      const previous = qc.getQueryData<CycleTree>(treeKey(cycleId));

      if (previous !== undefined) {
        qc.setQueryData<CycleTree>(treeKey(cycleId), {
          ...previous,
          day_targets: result.day_targets,
        });
      }
    },
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
      name?: string;
      status?: CycleStatus;
      durationDays?: number;
      startDate?: string;
    }) => updateCycle(cycleId, patch),
    // Flip the header (status/name/date) in the cache right away so the change
    // shows without waiting for the refetch; roll back on error, reconcile on
    // settle. Prevents the "only updates after refresh" activation lag.
    onMutate: async (patch) => {
      // Cancel BOTH caches we patch, or an in-flight list refetch could land
      // after the optimistic write and briefly revert the header.
      await Promise.all([
        qc.cancelQueries({ queryKey: treeKey(cycleId) }),
        qc.cancelQueries({ queryKey: cyclesKey(clientId) }),
      ]);

      const previousTree = qc.getQueryData<CycleTree>(treeKey(cycleId));
      const previousCycles = qc.getQueryData<CycleSummary[]>(
        cyclesKey(clientId)
      );

      const apply = <T extends CycleSummary>(cycle: T): T => ({
        ...cycle,
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.startDate !== undefined
          ? { start_date: patch.startDate }
          : {}),
        ...(patch.durationDays !== undefined
          ? { duration_days: patch.durationDays }
          : {}),
      });

      if (previousTree !== undefined) {
        qc.setQueryData<CycleTree>(treeKey(cycleId), apply(previousTree));
      }
      if (previousCycles !== undefined) {
        qc.setQueryData<CycleSummary[]>(
          cyclesKey(clientId),
          previousCycles.map((cycle) =>
            cycle.id === cycleId ? apply(cycle) : cycle
          )
        );
      }

      return { previousTree, previousCycles };
    },
    onError: (_error, _patch, context) => {
      if (context?.previousTree !== undefined) {
        qc.setQueryData(treeKey(cycleId), context.previousTree);
      }
      if (context?.previousCycles !== undefined) {
        qc.setQueryData(cyclesKey(clientId), context.previousCycles);
      }
    },
    onSettled: () => {
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
  const updateOptionPortionsM = useMutation({
    mutationFn: (vars: {
      slotId: string;
      optionId: string;
      quantities: number[];
      trainerComment?: string;
    }) =>
      updateOptionPortions(
        cycleId,
        vars.slotId,
        vars.optionId,
        vars.quantities,
        vars.trainerComment
      ),
    onSuccess: invalidate,
  });
  const updateOptionIngredientsM = useMutation({
    mutationFn: (vars: {
      slotId: string;
      optionId: string;
      edits: OptionIngredientEdit[];
      trainerComment?: string;
    }) =>
      updateOptionIngredients(
        cycleId,
        vars.slotId,
        vars.optionId,
        vars.edits,
        vars.trainerComment
      ),
    onSuccess: invalidate,
  });
  const copyDayM = useMutation({
    mutationFn: (vars: { sourceDayIndex: number; targetDayIndex: number }) =>
      copyDay(cycleId, vars.sourceDayIndex, vars.targetDayIndex),
    onSuccess: invalidate,
  });
  // Add/remove day change duration_days, which lives on the cycle summary too,
  // so refresh both the tree and any cached cycle lists.
  const invalidateDays = () => {
    invalidate();
    qc.invalidateQueries({ queryKey: ["cycles"] });
  };
  const addDayM = useMutation({
    mutationFn: (vars: { copyFromDayIndex?: number } = {}) =>
      addDay(cycleId, vars.copyFromDayIndex),
    onSuccess: invalidateDays,
  });
  const removeDayM = useMutation({
    mutationFn: (dayIndex: number) => removeDay(cycleId, dayIndex),
    onSuccess: invalidateDays,
  });
  const reorderDayM = useMutation({
    mutationFn: (vars: { fromIndex: number; toIndex: number }) =>
      reorderDay(cycleId, vars.fromIndex, vars.toIndex),
    // Renumber the cached slots right away so the day strip reorders instantly,
    // rolling back on error and reconciling with the server on settle.
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: treeKey(cycleId) });

      const previous = qc.getQueryData<CycleTree>(treeKey(cycleId));

      if (previous !== undefined) {
        const mapping = dayReorderMapping(
          previous.duration_days,
          vars.fromIndex,
          vars.toIndex
        );

        // Day-keyed maps (objectives, names) follow the same permutation so
        // the selected day's panel doesn't flash stale data until the refetch.
        const remapDayMap = (map: Record<string, string> | undefined) => {
          if (map === undefined) return undefined;
          const next: Record<string, string> = {};

          for (const [key, value] of Object.entries(map)) {
            next[String(mapping[Number(key)] ?? Number(key))] = value;
          }

          return next;
        };
        const dayTargets = remapDayMap(previous.day_targets);
        const dayNames = remapDayMap(previous.day_names);

        qc.setQueryData<CycleTree>(treeKey(cycleId), {
          ...previous,
          slots: previous.slots.map((slot) => {
            const next = mapping[slot.day_index];

            return next === undefined ? slot : { ...slot, day_index: next };
          }),
          ...(dayTargets !== undefined ? { day_targets: dayTargets } : {}),
          ...(dayNames !== undefined ? { day_names: dayNames } : {}),
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

  return {
    addSlotM,
    updateSlotM,
    deleteSlotM,
    addOptionM,
    deleteOptionM,
    updateOptionPortionsM,
    updateOptionIngredientsM,
    copyDayM,
    addDayM,
    removeDayM,
    reorderDayM,
  };
}

export function useRecipeSearch(query: string) {
  return useQuery<RecipeHit[]>({
    queryKey: ["cycle-recipe-search", query],
    queryFn: () => searchRecipes(query),
    enabled: query.trim().length > 0,
  });
}

export function useFoodSearch(query: string, brand = "") {
  // Debounce so a request fires per pause, not per keystroke (OFF rate-limits),
  // and keep the previous results on screen while the next page loads.
  const debounced = useDebouncedValue(query.trim(), 300);
  const debouncedBrand = useDebouncedValue(brand.trim(), 300);

  return useQuery<FoodHit[]>({
    queryKey: ["cycle-food-search", debounced, debouncedBrand],
    queryFn: () => searchFoods(debounced, debouncedBrand),
    // The name query drives the search; brand only refines it (the API requires
    // a non-empty `q`), so we wait for a name before firing.
    enabled: debounced.length >= 2,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}
