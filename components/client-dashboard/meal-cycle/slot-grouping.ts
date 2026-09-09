import type { MealSlotWithOptions } from "@/lib/nutrition/cycles/meal-cycle-service";
import type { MealSlotOptionRow } from "@/lib/nutrition/cycles/meal-slot-option-service";

import { normalizeOptionSnapshot } from "@/components/client-dashboard/meal-cycle/normalize-snapshot";

/** A component of a meal: options sharing a `group_index` are alternatives. */
export interface SlotComponent {
  groupIndex: number;
  options: MealSlotOptionRow[];
}

/** The 4 planned macros the client summary shows (subset of NutrientTotals). */
export interface PlannedTotals {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export const EMPTY_PLANNED: PlannedTotals = {
  kcal: 0,
  protein_g: 0,
  carbs_g: 0,
  fat_g: 0,
};

/**
 * Group a slot's options into components: same `group_index` = alternatives
 * (choose one), different = separate items that sum toward the meal. Options
 * arrive position-ordered from the server; that order is preserved within each
 * component so the rendered list is stable across re-renders and selections.
 */
export function slotComponents(options: MealSlotOptionRow[]): SlotComponent[] {
  const byGroup = new Map<number, MealSlotOptionRow[]>();

  for (const option of options) {
    const group = byGroup.get(option.group_index);

    if (group === undefined) {
      byGroup.set(option.group_index, [option]);
    } else {
      group.push(option);
    }
  }

  return [...byGroup.entries()]
    .sort(([a], [b]) => a - b)
    .map(([groupIndex, groupOptions]) => ({
      groupIndex,
      options: groupOptions,
    }));
}

/**
 * The option the client is set to eat for a component: the one of their
 * standing picks that points inside this component, else the first option (the
 * same fallback the shopping list uses).
 */
export function chosenOption(
  component: SlotComponent,
  selectedOptionIds: readonly string[]
): MealSlotOptionRow | null {
  const selected = component.options.find((option) =>
    selectedOptionIds.includes(option.id)
  );

  return selected ?? component.options[0] ?? null;
}

/**
 * The slot's picks after choosing `optionId`: its alternatives (same
 * `group_index`) drop out, picks in other components stay. Pure — used for the
 * optimistic cache update, mirroring what the server persists.
 */
export function withSelection(
  selections: Record<string, string[]>,
  slotOptions: readonly MealSlotOptionRow[],
  slotId: string,
  optionId: string
): Record<string, string[]> {
  const target = slotOptions.find((option) => option.id === optionId);
  const siblings = new Set(
    slotOptions
      .filter((option) => option.group_index === target?.group_index)
      .map((option) => option.id)
  );
  const kept = (selections[slotId] ?? []).filter((id) => !siblings.has(id));

  return { ...selections, [slotId]: [...kept, optionId] };
}

/** Sum the chosen option of every component of one slot. */
export function slotPlannedTotals(
  options: MealSlotOptionRow[],
  selectedOptionIds: readonly string[]
): PlannedTotals {
  const totals = { ...EMPTY_PLANNED };

  for (const component of slotComponents(options)) {
    const chosen = chosenOption(component, selectedOptionIds);

    if (chosen === null) {
      continue;
    }

    const t = normalizeOptionSnapshot(chosen.item_snapshot).totals;

    totals.kcal += t.kcal;
    totals.protein_g += t.protein_g;
    totals.carbs_g += t.carbs_g;
    totals.fat_g += t.fat_g;
  }

  return totals;
}

/** Sum every slot of the day (what the "Nutrición del día" card shows). */
export function dayPlannedTotals(
  slots: MealSlotWithOptions[],
  selections: Record<string, string[]>
): PlannedTotals {
  const totals = { ...EMPTY_PLANNED };

  for (const slot of slots) {
    const slotTotals = slotPlannedTotals(
      slot.options,
      selections[slot.id] ?? []
    );

    totals.kcal += slotTotals.kcal;
    totals.protein_g += slotTotals.protein_g;
    totals.carbs_g += slotTotals.carbs_g;
    totals.fat_g += slotTotals.fat_g;
  }

  return totals;
}

/** Percentage of `target` reached, clamped to 0–100 and rounded. */
export function pctOf(value: number, target: number): number {
  if (target <= 0) {
    return 0;
  }

  return Math.round(Math.min(100, Math.max(0, (value / target) * 100)));
}
