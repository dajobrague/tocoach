import type { ClientWeekDay } from "@/lib/nutrition/cycles/client-week";
import type { MealSlotWithOptions } from "@/lib/nutrition/cycles/meal-cycle-service";
import type {
  IngredientLine,
  ShoppingListItem,
} from "@/lib/nutrition/shopping/shopping-list";

import { mergeIngredientLines } from "@/lib/nutrition/shopping/shopping-list";

/**
 * Pure helpers for the week shopping wizard. The list is built ONLY from the
 * meals the client explicitly picks; aggregation reuses the §4.6 merge
 * (`mergeIngredientLines`). Swaps need no special handling — the wizard reads
 * the RESOLVED week days, whose slot options already carry the frozen swap
 * snapshot. No DOM — unit-tested directly.
 */

const PICKS_KEY_PREFIX = "topcoach.shopping-picks";
const CHECKED_KEY_PREFIX = "topcoach.shopping-wizard-checked";

/** A picked meal: a (date, slot) the client will make, with the chosen option. */
export interface WizardPick {
  date: string;
  slotId: string;
  optionId: string;
}

/** localStorage key for a week's picks (stable across reopens). */
export function picksStorageKey(weekStart: string): string {
  return `${PICKS_KEY_PREFIX}.${weekStart}`;
}

/** localStorage key for the generated list's check-off state, per week. */
export function wizardCheckedKey(weekStart: string): string {
  return `${CHECKED_KEY_PREFIX}.${weekStart}`;
}

/** Stable identity for a meal in the wizard (a slot on a specific date). */
export function mealKey(date: string, slotId: string): string {
  return `${date}::${slotId}`;
}

/**
 * The default option for a meal: the client's standing selection when it is an
 * option on this (resolved) slot, otherwise the first option. `null` when the
 * slot has no options (nothing to pick).
 */
export function defaultOptionId(
  slot: MealSlotWithOptions,
  selections: Record<string, string>
): string | null {
  const selected = selections[slot.id];

  if (selected !== undefined && slot.options.some((o) => o.id === selected)) {
    return selected;
  }

  return slot.options[0]?.id ?? null;
}

/**
 * Aggregate ingredients ONLY from the picked meals into a merged, sorted list.
 * Each pick resolves to its option on the resolved week day (falling back to the
 * slot's first option), so a swapped meal contributes the swapped ingredients.
 * Picks pointing at a missing day/slot are skipped.
 */
export function aggregatePickedMeals(
  days: ClientWeekDay[],
  picks: WizardPick[]
): ShoppingListItem[] {
  const byDate = new Map(days.map((day) => [day.date, day]));
  const lines: IngredientLine[] = [];

  for (const pick of picks) {
    const day = byDate.get(pick.date);
    const slot = day?.slots.find((s) => s.id === pick.slotId);

    if (slot === undefined) {
      continue;
    }

    const option =
      slot.options.find((o) => o.id === pick.optionId) ?? slot.options[0];

    if (option === undefined) {
      continue;
    }

    for (const ingredient of option.item_snapshot.ingredients ?? []) {
      lines.push({
        name: ingredient.name,
        brand: ingredient.brand ?? null,
        unit: ingredient.unit,
        quantity: ingredient.quantity,
      });
    }
  }

  return mergeIngredientLines(lines);
}

/** Turn a stored picks map (mealKey → optionId) into resolved {@link WizardPick}s. */
export function picksFromMap(map: Record<string, string>): WizardPick[] {
  const picks: WizardPick[] = [];

  for (const [key, optionId] of Object.entries(map)) {
    const [date, slotId] = key.split("::");

    if (date !== undefined && slotId !== undefined) {
      picks.push({ date, slotId, optionId });
    }
  }

  return picks;
}
