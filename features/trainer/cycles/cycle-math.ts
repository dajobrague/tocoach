import type { CycleSlot, CycleTree, SlotOption } from "./cycle-api";

import { groupSlotsByDay } from "./cycle-api";

export interface MacroTotals {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

/**
 * Placeholder daily targets used by the progress UI until per-client targets
 * are stored. Replace with real targets when a target editor exists.
 */
export const DEFAULT_TARGETS: MacroTotals = {
  kcal: 2000,
  protein_g: 160,
  carbs_g: 200,
  fat_g: 60,
};

/** Percentage of a target, clamped to [0, 100] for bar widths. */
export function pct(value: number, target: number): number {
  if (target <= 0) return 0;

  return Math.min(100, Math.max(0, Math.round((value / target) * 100)));
}

const ZERO: MacroTotals = { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };

function add(acc: MacroTotals, totals: SlotOption["item_snapshot"]["totals"]) {
  return {
    kcal: acc.kcal + (Number(totals.kcal) || 0),
    protein_g: acc.protein_g + (Number(totals.protein_g) || 0),
    carbs_g: acc.carbs_g + (Number(totals.carbs_g) || 0),
    fat_g: acc.fat_g + (Number(totals.fat_g) || 0),
  };
}

function round(totals: MacroTotals): MacroTotals {
  return {
    kcal: Math.round(totals.kcal),
    protein_g: Math.round(totals.protein_g),
    carbs_g: Math.round(totals.carbs_g),
    fat_g: Math.round(totals.fat_g),
  };
}

export interface MealComponent {
  groupIndex: number;
  /** Alternatives within the component; the first is the primary. */
  options: SlotOption[];
}

/** Group a slot's options into components (by group_index, ordered). Options
 *  sharing a group are alternatives; separate groups are summed components. */
export function slotComponents(slot: CycleSlot): MealComponent[] {
  const byGroup = new Map<number, SlotOption[]>();

  for (const option of slot.options) {
    const group = option.group_index ?? 0;
    const list = byGroup.get(group) ?? [];

    list.push(option);
    byGroup.set(group, list);
  }

  return Array.from(byGroup.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([groupIndex, options]) => ({ groupIndex, options }));
}

/** Meal nutrition = sum of each component's PRIMARY option (components add up;
 *  alternatives within a component are choose-one, so only the primary counts). */
export function slotTotals(slot: CycleSlot): MacroTotals {
  const sum = slotComponents(slot).reduce((acc, component) => {
    const primary = component.options[0];

    return primary === undefined ? acc : add(acc, primary.item_snapshot.totals);
  }, ZERO);

  return round(sum);
}

/** Day nutrition = sum of every meal's component totals. */
export function dayTotals(slots: CycleSlot[]): MacroTotals {
  const sum = slots.reduce((acc, slot) => {
    const totals = slotTotals(slot);

    return {
      kcal: acc.kcal + totals.kcal,
      protein_g: acc.protein_g + totals.protein_g,
      carbs_g: acc.carbs_g + totals.carbs_g,
      fat_g: acc.fat_g + totals.fat_g,
    };
  }, ZERO);

  return round(sum);
}

export type DayStatus = "empty" | "incomplete" | "complete";

/**
 * empty = no meals; incomplete = some meal has no option yet;
 * complete = every meal has at least one option.
 */
export function dayStatus(slots: CycleSlot[]): DayStatus {
  if (slots.length === 0) return "empty";

  return slots.every((slot) => slot.options.length > 0)
    ? "complete"
    : "incomplete";
}

export interface CycleMetrics {
  avgKcal: number;
  avgProtein: number;
  avgCarbs: number;
  avgFat: number;
  /** Meal slots that have at least one option assigned. */
  plannedMeals: number;
  completedDays: number;
  totalDays: number;
}

/** High-level metrics for the cycle summary card. Averages over PLANNED days
 *  (days with at least one meal) so empty days don't drag the average to zero. */
export function cycleMetrics(tree: CycleTree): CycleMetrics {
  const days = groupSlotsByDay(tree.slots, tree.duration_days);
  const plannedDays = days.filter((day) => day.slots.length > 0);
  const divisor = plannedDays.length > 0 ? plannedDays.length : 1;

  const sum = plannedDays.reduce((acc, day) => {
    const totals = dayTotals(day.slots);

    return {
      kcal: acc.kcal + totals.kcal,
      protein_g: acc.protein_g + totals.protein_g,
      carbs_g: acc.carbs_g + totals.carbs_g,
      fat_g: acc.fat_g + totals.fat_g,
    };
  }, ZERO);

  return {
    avgKcal: Math.round(sum.kcal / divisor),
    avgProtein: Math.round(sum.protein_g / divisor),
    avgCarbs: Math.round(sum.carbs_g / divisor),
    avgFat: Math.round(sum.fat_g / divisor),
    plannedMeals: tree.slots.filter((slot) => slot.options.length > 0).length,
    completedDays: days.filter((day) => dayStatus(day.slots) === "complete")
      .length,
    totalDays: days.length,
  };
}
