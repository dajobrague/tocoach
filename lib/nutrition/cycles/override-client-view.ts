import type { ClientCycleView } from "./cycle-day";
import type { MealCycleTree, MealSlotWithOptions } from "./meal-cycle-service";
import type { MealSlotOptionRow } from "./meal-slot-option-service";
import type { EffectiveSwap } from "./override-resolution";
import type { OverrideRow } from "./override-types";

import { resolveOverridesForDate } from "./override-resolution";

/**
 * Fold a cycle's overrides into the client's already-built "today" view (P7-T4).
 *
 * Pure: resolves the effective day for `today` (scope precedence + frozen
 * swaps, via {@link resolveOverridesForDate}) and returns a new view where
 * today's swapped slots show the frozen `swap_snapshot` as their single option,
 * and the day's notes are attached. Other rotation days are left as the base
 * plan — the today view is what surfaces overrides. No DB, no live recipe read.
 */
export function applyOverridesToClientView(
  view: ClientCycleView,
  tree: MealCycleTree | null,
  overrides: OverrideRow[],
  today: string | Date,
  timeZone = "UTC",
  /** The client's menu choice for the date — swaps then resolve against (and
   *  rewrite) that day instead of the rotation's. */
  dayIndexOverride?: number
): ClientCycleView {
  if (tree === null || view.position === null) {
    return view;
  }

  const effective = resolveOverridesForDate(
    tree,
    overrides,
    today,
    timeZone,
    dayIndexOverride
  );
  const notes = effective.notes.map((note) => ({
    id: note.id,
    slotId: note.slotId,
    text: note.text,
  }));

  // slotId → winning swap for today.
  const swapBySlot = new Map<string, EffectiveSwap>();

  for (const slot of effective.slots) {
    if (slot.swap !== null) {
      swapBySlot.set(slot.slotId, slot.swap);
    }
  }

  const todayIndex = effective.dayIndex ?? view.position.dayIndex;

  if (todayIndex === null || swapBySlot.size === 0) {
    return { ...view, notes };
  }

  const days = view.days.map((day) => {
    if (day.dayIndex !== todayIndex) {
      return day;
    }

    return {
      ...day,
      slots: day.slots.map((slot) => {
        const swap = swapBySlot.get(slot.id);

        return swap === undefined
          ? slot
          : { ...slot, options: swapOptions(slot, swap) };
      }),
    };
  });

  return { ...view, days, notes };
}

/**
 * Synthetic options carrying the frozen swap snapshot(s), so the client renders
 * the swapped meal exactly like any other option (same recipe detail) — fully
 * decoupled from the live library. Multi-item swaps become separate components
 * (distinct `group_index`) so they sum toward the meal.
 */
function swapOptions(
  slot: MealSlotWithOptions,
  swap: EffectiveSwap
): MealSlotOptionRow[] {
  return swap.snapshots.map((snapshot, index) => ({
    id: `override-${swap.overrideId}-${index}`,
    slot_id: slot.id,
    tenant_host: slot.tenant_host,
    source_type: snapshot.sourceType,
    source_ref_id: snapshot.sourceRefId,
    item_snapshot: snapshot,
    position: index,
    group_index: index,
    created_at: slot.created_at,
    updated_at: slot.updated_at,
  }));
}
