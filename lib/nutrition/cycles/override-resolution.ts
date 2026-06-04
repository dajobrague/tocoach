import type { MealCycleTree, MealSlotWithOptions } from "./meal-cycle-service";
import type { MealSlotOptionRow } from "./meal-slot-option-service";
import type { OptionSnapshot } from "./option-snapshot";
import type { OverrideRow, OverrideScope } from "./override-types";

import { currentCycleDayIndex, groupSlotsByDay } from "./cycle-day";

/**
 * Pure override resolution (P7) — the core of the slice.
 *
 * Given a cycle tree, its overrides, and a target date, produce the EFFECTIVE
 * day: the base slots for that rotation day with any winning swap applied, plus
 * the notes that apply. No DB and no `Date.now()` — deterministic from inputs.
 *
 * Scope precedence, most-specific wins, per slot for swaps:
 *   single_day (anchor == date) > day_forward (anchor <= date)
 *   > every_cycle (day_index == rotation index of date)
 * Ties within a scope break by `created_at` descending (the latest edit wins).
 * A swap replaces its slot's options with its frozen `swap_snapshot` (never a
 * live recipe read). Notes are additive: every applicable note attaches to the
 * date.
 */

/** A winning swap for a slot — the frozen snapshot replaces the slot's options. */
export interface EffectiveSwap {
  overrideId: string;
  snapshot: OptionSnapshot;
}

/** One slot of the effective day: its base options, plus any winning swap. */
export interface EffectiveSlot {
  slotId: string;
  label: string;
  options: MealSlotOptionRow[];
  swap: EffectiveSwap | null;
}

/** A note that applies to the date (date-level when `slotId` is null). */
export interface EffectiveNote {
  id: string;
  slotId: string | null;
  text: string;
  scope: OverrideScope;
}

/** The resolved day a client/trainer view renders. */
export interface EffectiveDay {
  date: string;
  /** Rotation day index, or `null` before the cycle starts. */
  dayIndex: number | null;
  slots: EffectiveSlot[];
  notes: EffectiveNote[];
}

/** Specificity rank: higher beats lower. */
const SCOPE_RANK: Record<OverrideScope, number> = {
  single_day: 3,
  day_forward: 2,
  every_cycle: 1,
};

export function resolveOverridesForDate(
  tree: MealCycleTree | null,
  overrides: OverrideRow[],
  date: string | Date,
  timeZone = "UTC"
): EffectiveDay {
  const dateYmd = toYmd(date, timeZone);

  if (tree === null) {
    return { date: dateYmd, dayIndex: null, slots: [], notes: [] };
  }

  const position = currentCycleDayIndex(
    tree.start_date,
    tree.duration_days,
    date,
    timeZone
  );
  const dayIndex = position.started === true ? position.dayIndex : null;
  const daySlots: MealSlotWithOptions[] =
    dayIndex === null
      ? []
      : (groupSlotsByDay(tree.duration_days, tree.slots)[dayIndex]?.slots ??
        []);

  const applicable = overrides.filter((override) =>
    appliesToDate(override, dateYmd, dayIndex)
  );

  return {
    date: dateYmd,
    dayIndex,
    slots: daySlots.map((slot) => resolveSlot(slot, applicable)),
    notes: resolveNotes(applicable),
  };
}

/** True when `override`'s scope reaches `dateYmd` (given the rotation index). */
function appliesToDate(
  override: OverrideRow,
  dateYmd: string,
  dayIndex: number | null
): boolean {
  switch (override.scope) {
    case "single_day":
      return override.anchor_date === dateYmd;
    case "day_forward":
      return override.anchor_date <= dateYmd;
    case "every_cycle":
      // Repeats by rotation index — meaningless before the cycle starts.
      return dayIndex !== null && override.day_index === dayIndex;
    default:
      return false;
  }
}

/** The base slot plus the winning swap among applicable swaps for it. */
function resolveSlot(
  slot: MealSlotWithOptions,
  applicable: OverrideRow[]
): EffectiveSlot {
  const swaps = applicable.filter(
    (override) =>
      override.override_type === "swap" &&
      override.slot_id === slot.id &&
      override.swap_snapshot !== null
  );
  const winner = pickWinner(swaps);

  return {
    slotId: slot.id,
    label: slot.label,
    options: slot.options,
    swap:
      winner === null
        ? null
        : { overrideId: winner.id, snapshot: winner.swap_snapshot! },
  };
}

/** Most-specific scope wins; ties break by latest `created_at`. */
function pickWinner(candidates: OverrideRow[]): OverrideRow | null {
  if (candidates.length === 0) {
    return null;
  }

  return [...candidates].sort((a, b) => {
    const byScope = SCOPE_RANK[b.scope] - SCOPE_RANK[a.scope];

    if (byScope !== 0) {
      return byScope;
    }

    // Latest created_at first (ISO timestamps compare lexicographically).
    return b.created_at.localeCompare(a.created_at);
  })[0]!;
}

/** Every applicable note, additive, oldest first. */
function resolveNotes(applicable: OverrideRow[]): EffectiveNote[] {
  return applicable
    .filter(
      (override) =>
        override.override_type === "note" && override.note_text !== null
    )
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((override) => ({
      id: override.id,
      slotId: override.slot_id,
      text: override.note_text!,
      scope: override.scope,
    }));
}

/** The calendar day (`YYYY-MM-DD`) `value` represents in `timeZone`. */
function toYmd(value: string | Date, timeZone: string): string {
  if (value instanceof Date) {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(value);
  }

  return value.slice(0, 10);
}
