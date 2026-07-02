import type { MealCycleTree, MealSlotWithOptions } from "../../cycles";
import type { MealSlotOptionRow } from "../../cycles";
import type { ClientSelection } from "../../cycles/option-selection";
import type { SnapshotIngredient } from "../../cycles/option-snapshot";

import { describe, expect, it } from "vitest";

import { aggregateShoppingList } from "../shopping-list";

/**
 * §4.6 — shopping-list aggregation. These exercise the merge/sum and
 * unit-separation rules and the selection→first-option fallback that the human
 * reviewer cares about most. All pure: no DB, deterministic from the tree +
 * selections + [from, to].
 */

function ingredient(
  name: string,
  quantity: number,
  unit = "g"
): SnapshotIngredient {
  return { name, quantity, unit, gramsPerUnit: null, nutrientsPer100g: {} };
}

function option(
  id: string,
  position: number,
  ingredients: SnapshotIngredient[]
): MealSlotOptionRow {
  return {
    id,
    slot_id: "ignored",
    tenant_host: "t.local",
    source_type: "recipe",
    source_ref_id: "r1",
    position,
    group_index: 0,
    created_at: "2026-06-01T00:00:00Z",
    updated_at: "2026-06-01T00:00:00Z",
    item_snapshot: {
      sourceType: "recipe",
      sourceRefId: "r1",
      name: `Option ${id}`,
      steps: null,
      images: [],
      media: [],
      ingredients,
      totals: {
        kcal: 0,
        protein_g: 0,
        carbs_g: 0,
        fat_g: 0,
        sugar_g: 0,
        fiber_g: 0,
        sat_fat_g: 0,
        sodium_mg: 0,
      },
    },
  };
}

function slot(
  id: string,
  dayIndex: number,
  options: MealSlotOptionRow[],
  position = 0
): MealSlotWithOptions {
  return {
    id,
    cycle_id: "cycle-1",
    tenant_host: "t.local",
    day_index: dayIndex,
    label: "",
    position,
    created_at: "2026-06-01T00:00:00Z",
    updated_at: "2026-06-01T00:00:00Z",
    options,
  };
}

function tree(
  slots: MealSlotWithOptions[],
  durationDays = 1,
  startDate = "2026-06-01"
): MealCycleTree {
  return {
    id: "cycle-1",
    tenant_host: "t.local",
    trainer_id: "trainer-1",
    client_id: 1,
    name: "Plan",
    duration_days: durationDays,
    start_date: startDate,
    status: "active",
    created_at: "2026-06-01T00:00:00Z",
    updated_at: "2026-06-01T00:00:00Z",
    slots,
  };
}

const NO_SELECTIONS: ClientSelection[] = [];

describe("aggregateShoppingList — empty / no-active-cycle", () => {
  it("returns [] when there is no active cycle (tree null)", () => {
    expect(
      aggregateShoppingList({
        tree: null,
        selections: NO_SELECTIONS,
        from: "2026-06-01",
        to: "2026-06-07",
      })
    ).toEqual([]);
  });

  it("returns [] for an empty range (from after to)", () => {
    const t = tree([
      slot("s1", 0, [option("o1", 0, [ingredient("Oats", 50)])]),
    ]);

    expect(
      aggregateShoppingList({
        tree: t,
        selections: NO_SELECTIONS,
        from: "2026-06-07",
        to: "2026-06-01",
      })
    ).toEqual([]);
  });

  it("returns [] when the cycle has slots but no options", () => {
    const t = tree([slot("s1", 0, [])]);

    expect(
      aggregateShoppingList({
        tree: t,
        selections: NO_SELECTIONS,
        from: "2026-06-01",
        to: "2026-06-03",
      })
    ).toEqual([]);
  });
});

describe("aggregateShoppingList — sum across days", () => {
  it("sums the same ingredient across 7 days (7 days of oats → 7×)", () => {
    // 1-day cycle, so every date in the range maps to the same day-0 slot.
    const t = tree([
      slot("s1", 0, [option("o1", 0, [ingredient("Oats", 50)])]),
    ]);

    const items = aggregateShoppingList({
      tree: t,
      selections: NO_SELECTIONS,
      from: "2026-06-01",
      to: "2026-06-07",
    });

    expect(items).toEqual([{ name: "Oats", unit: "g", quantity: 350 }]);
  });

  it("sums a single day (range of one) without multiplying", () => {
    const t = tree([
      slot("s1", 0, [option("o1", 0, [ingredient("Oats", 50)])]),
    ]);

    const items = aggregateShoppingList({
      tree: t,
      selections: NO_SELECTIONS,
      from: "2026-06-01",
      to: "2026-06-01",
    });

    expect(items).toEqual([{ name: "Oats", unit: "g", quantity: 50 }]);
  });

  it("merges duplicate (name, unit) lines within and across days", () => {
    // Two slots on the same day each contribute oats; over 2 days → 4 lines.
    const t = tree([
      slot("s1", 0, [option("a", 0, [ingredient("Oats", 50)])]),
      slot("s2", 0, [option("b", 0, [ingredient("Oats", 30)])], 1),
    ]);

    const items = aggregateShoppingList({
      tree: t,
      selections: NO_SELECTIONS,
      from: "2026-06-01",
      to: "2026-06-02",
    });

    expect(items).toEqual([{ name: "Oats", unit: "g", quantity: 160 }]);
  });
});

describe("aggregateShoppingList — unit separation (never merge across units)", () => {
  it("keeps g and ml of the same name as separate lines", () => {
    const t = tree([
      slot("s1", 0, [
        option("o1", 0, [
          ingredient("Milk", 200, "ml"),
          ingredient("Milk", 100, "g"),
        ]),
      ]),
    ]);

    const items = aggregateShoppingList({
      tree: t,
      selections: NO_SELECTIONS,
      from: "2026-06-01",
      to: "2026-06-01",
    });

    // Distinct units stay distinct; sorted by name then unit (g before ml).
    expect(items).toEqual([
      { name: "Milk", unit: "g", quantity: 100 },
      { name: "Milk", unit: "ml", quantity: 200 },
    ]);
  });

  it("sums each unit independently across the range", () => {
    const t = tree([
      slot("s1", 0, [
        option("o1", 0, [
          ingredient("Milk", 200, "ml"),
          ingredient("Milk", 100, "g"),
        ]),
      ]),
    ]);

    const items = aggregateShoppingList({
      tree: t,
      selections: NO_SELECTIONS,
      from: "2026-06-01",
      to: "2026-06-03",
    });

    expect(items).toEqual([
      { name: "Milk", unit: "g", quantity: 300 },
      { name: "Milk", unit: "ml", quantity: 600 },
    ]);
  });
});

describe("aggregateShoppingList — fractional quantities", () => {
  it("sums fractional quantities across days", () => {
    const t = tree([
      slot("s1", 0, [option("o1", 0, [ingredient("Aceite", 0.5, "tbsp")])]),
    ]);

    const items = aggregateShoppingList({
      tree: t,
      selections: NO_SELECTIONS,
      from: "2026-06-01",
      to: "2026-06-03",
    });

    expect(items).toHaveLength(1);
    expect(items[0]?.name).toBe("Aceite");
    expect(items[0]?.unit).toBe("tbsp");
    expect(items[0]?.quantity).toBeCloseTo(1.5, 10);
  });
});

describe("aggregateShoppingList — selection / first-option fallback", () => {
  function twoOptionSlot(): MealSlotWithOptions {
    // Option B is first by position; option A has a higher position.
    return slot("s1", 0, [
      option("optA", 1, [ingredient("Pollo", 200)]),
      option("optB", 0, [ingredient("Tofu", 150)]),
    ]);
  }

  it("uses the slot's FIRST option (lowest position) when there is no selection", () => {
    const items = aggregateShoppingList({
      tree: tree([twoOptionSlot()]),
      selections: NO_SELECTIONS,
      from: "2026-06-01",
      to: "2026-06-01",
    });

    // optB is first by position → Tofu, not Pollo.
    expect(items).toEqual([{ name: "Tofu", unit: "g", quantity: 150 }]);
  });

  it("uses the SELECTED option when the client has chosen one", () => {
    const items = aggregateShoppingList({
      tree: tree([twoOptionSlot()]),
      selections: [{ slot_id: "s1", option_id: "optA" }],
      from: "2026-06-01",
      to: "2026-06-01",
    });

    expect(items).toEqual([{ name: "Pollo", unit: "g", quantity: 200 }]);
  });

  it("falls back to the first option when the selection points to a missing option", () => {
    // Stale selection (option no longer in the slot) must not blank the slot.
    const items = aggregateShoppingList({
      tree: tree([twoOptionSlot()]),
      selections: [{ slot_id: "s1", option_id: "deleted-option" }],
      from: "2026-06-01",
      to: "2026-06-01",
    });

    expect(items).toEqual([{ name: "Tofu", unit: "g", quantity: 150 }]);
  });

  it("ignores a selection that targets a different slot", () => {
    const items = aggregateShoppingList({
      tree: tree([twoOptionSlot()]),
      selections: [{ slot_id: "other-slot", option_id: "optA" }],
      from: "2026-06-01",
      to: "2026-06-01",
    });

    // Selection is for another slot → first option of s1 wins.
    expect(items).toEqual([{ name: "Tofu", unit: "g", quantity: 150 }]);
  });
});

describe("aggregateShoppingList — dates before cycle start contribute nothing", () => {
  it("skips dates before start_date and counts only on/after it", () => {
    // 1-day cycle starting 2026-06-05. Range spans before + after the start.
    const t = tree(
      [slot("s1", 0, [option("o1", 0, [ingredient("Oats", 50)])])],
      1,
      "2026-06-05"
    );

    const items = aggregateShoppingList({
      tree: t,
      selections: NO_SELECTIONS,
      from: "2026-06-01",
      to: "2026-06-07",
    });

    // Only 2026-06-05, -06, -07 count (3 days) → 150g, not 350g.
    expect(items).toEqual([{ name: "Oats", unit: "g", quantity: 150 }]);
  });

  it("returns [] when the whole range is before the cycle start", () => {
    const t = tree(
      [slot("s1", 0, [option("o1", 0, [ingredient("Oats", 50)])])],
      1,
      "2026-07-01"
    );

    expect(
      aggregateShoppingList({
        tree: t,
        selections: NO_SELECTIONS,
        from: "2026-06-01",
        to: "2026-06-07",
      })
    ).toEqual([]);
  });
});

describe("aggregateShoppingList — multi-day rotation", () => {
  it("maps each date to its rotation day and aggregates per-day slots", () => {
    // 2-day cycle: day 0 = Oats 50g, day 1 = Rice 80g. Start 2026-06-01.
    const t = tree(
      [
        slot("s0", 0, [option("o0", 0, [ingredient("Oats", 50)])]),
        slot("s1", 1, [option("o1", 0, [ingredient("Rice", 80)])]),
      ],
      2,
      "2026-06-01"
    );

    // Range 06-01..06-04 → days [0,1,0,1] → Oats×2=100, Rice×2=160.
    const items = aggregateShoppingList({
      tree: t,
      selections: NO_SELECTIONS,
      from: "2026-06-01",
      to: "2026-06-04",
    });

    expect(items).toEqual([
      { name: "Oats", unit: "g", quantity: 100 },
      { name: "Rice", unit: "g", quantity: 160 },
    ]);
  });
});

describe("aggregateShoppingList — sorting & name normalization", () => {
  it("sorts items by name then unit and trims display names", () => {
    const t = tree([
      slot("s1", 0, [
        option("o1", 0, [
          ingredient("Zucchini", 100),
          ingredient("  Apple  ", 50),
          ingredient("Banana", 30),
        ]),
      ]),
    ]);

    const items = aggregateShoppingList({
      tree: t,
      selections: NO_SELECTIONS,
      from: "2026-06-01",
      to: "2026-06-01",
    });

    expect(items.map((i) => i.name)).toEqual(["Apple", "Banana", "Zucchini"]);
  });

  it("merges names that differ only by surrounding whitespace", () => {
    const t = tree([
      slot("s1", 0, [
        option("o1", 0, [ingredient("Oats", 50), ingredient(" Oats ", 25)]),
      ]),
    ]);

    const items = aggregateShoppingList({
      tree: t,
      selections: NO_SELECTIONS,
      from: "2026-06-01",
      to: "2026-06-01",
    });

    expect(items).toEqual([{ name: "Oats", unit: "g", quantity: 75 }]);
  });
});
