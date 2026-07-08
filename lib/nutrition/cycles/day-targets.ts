/**
 * Pure helpers for `meal_cycles.day_targets` — the map of day index (string
 * key, JSONB) → goal preset id. Days are implicit (duration_days + slot
 * day_index), so every operation that renumbers days must remap this map the
 * same way; keeping the remaps pure makes that contract unit-testable.
 */

export type DayTargets = Record<string, string>;

/** Defensive read: keep only string→string entries with integer keys ≥ 0. */
export function normalizeDayTargets(value: unknown): DayTargets {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }

  const out: DayTargets = {};

  for (const [key, presetId] of Object.entries(value)) {
    const index = Number(key);

    if (
      Number.isInteger(index) &&
      index >= 0 &&
      typeof presetId === "string" &&
      presetId.length > 0
    ) {
      out[String(index)] = presetId;
    }
  }

  return out;
}

/** Assign (or clear, with null) the preset for one day. */
export function setDayTarget(
  targets: DayTargets,
  dayIndex: number,
  presetId: string | null
): DayTargets {
  const next = { ...targets };

  if (presetId === null) {
    delete next[String(dayIndex)];
  } else {
    next[String(dayIndex)] = presetId;
  }

  return next;
}

/** After removing a day: drop its entry and shift later days down by one. */
export function remapOnRemoveDay(
  targets: DayTargets,
  removedIndex: number
): DayTargets {
  const next: DayTargets = {};

  for (const [key, presetId] of Object.entries(targets)) {
    const index = Number(key);

    if (index < removedIndex) next[key] = presetId;
    if (index > removedIndex) next[String(index - 1)] = presetId;
  }

  return next;
}

/**
 * After a drag-reorder: move each entry to its day's new index.
 * `mapping[oldIndex]` is that day's new index (see {@link dayReorderMapping}
 * in the trainer cycle feature and the same permutation in MealCycleService).
 */
export function remapOnReorderDay(
  targets: DayTargets,
  mapping: number[]
): DayTargets {
  const next: DayTargets = {};

  for (const [key, presetId] of Object.entries(targets)) {
    const newIndex = mapping[Number(key)];

    next[String(newIndex ?? Number(key))] = presetId;
  }

  return next;
}

/** After copying a day: the target day inherits the source day's objective
 *  (or loses its own when the source has none) — mirroring the slot copy. */
export function remapOnCopyDay(
  targets: DayTargets,
  sourceIndex: number,
  targetIndex: number
): DayTargets {
  const source = targets[String(sourceIndex)];

  return setDayTarget(targets, targetIndex, source ?? null);
}
