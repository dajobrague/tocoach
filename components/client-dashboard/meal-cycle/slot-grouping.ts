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
 * The option the client is set to eat for a component: their standing per-slot
 * selection when it points inside this component, else the first option (the
 * same fallback the shopping list uses).
 */
export function chosenOption(
  component: SlotComponent,
  selectedOptionId: string | null
): MealSlotOptionRow | null {
  if (selectedOptionId !== null) {
    const selected = component.options.find(
      (option) => option.id === selectedOptionId
    );

    if (selected !== undefined) {
      return selected;
    }
  }

  return component.options[0] ?? null;
}

/** Sum the chosen option of every component of one slot. */
export function slotPlannedTotals(
  options: MealSlotOptionRow[],
  selectedOptionId: string | null
): PlannedTotals {
  const totals = { ...EMPTY_PLANNED };

  for (const component of slotComponents(options)) {
    const chosen = chosenOption(component, selectedOptionId);

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
  selections: Record<string, string>
): PlannedTotals {
  const totals = { ...EMPTY_PLANNED };

  for (const slot of slots) {
    const slotTotals = slotPlannedTotals(
      slot.options,
      selections[slot.id] ?? null
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
