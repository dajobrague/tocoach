import type { CycleSlot, CycleTree, SlotOption } from "../cycle-api";

import { describe, expect, it } from "vitest";

import {
  cycleMetrics,
  dayStatus,
  dayTotals,
  kcalFromMacros,
  slotTotals,
} from "../cycle-math";

function option(
  totals: {
    kcal: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
  },
  groupIndex = 0
): SlotOption {
  return {
    id: `opt-${totals.kcal}-${groupIndex}`,
    slot_id: "s",
    source_type: "recipe",
    source_ref_id: "r",
    position: 0,
    group_index: groupIndex,
    item_snapshot: {
      sourceType: "recipe",
      sourceRefId: "r",
      name: "x",
      steps: null,
      images: [],
      ingredients: [],
      totals: { ...totals },
    },
  };
}

function slot(id: string, dayIndex: number, options: SlotOption[]): CycleSlot {
  return {
    id,
    cycle_id: "c",
    day_index: dayIndex,
    label: "M",
    position: 0,
    options,
  };
}

describe("kcalFromMacros", () => {
  it("applies 4/4/9 kcal per gram", () => {
    expect(kcalFromMacros(150, 200, 60)).toBe(1940);
    expect(kcalFromMacros(0, 0, 0)).toBe(0);
  });

  it("rounds to the nearest integer", () => {
    expect(kcalFromMacros(10.1, 0, 0)).toBe(40);
  });

  it("treats non-finite inputs (partially-typed fields) as 0", () => {
    expect(kcalFromMacros(NaN, 100, 10)).toBe(490);
  });
});

describe("dayTotals", () => {
  it("sums the primary (first) option of each slot", () => {
    const slots = [
      slot("s1", 0, [
        option({ kcal: 390, protein_g: 31, carbs_g: 4, fat_g: 21 }),
        option({ kcal: 250, protein_g: 20, carbs_g: 10, fat_g: 5 }), // alt, ignored
      ]),
      slot("s2", 0, [
        option({ kcal: 600, protein_g: 40, carbs_g: 70, fat_g: 15 }),
      ]),
    ];

    expect(dayTotals(slots)).toEqual({
      kcal: 990,
      protein_g: 71,
      carbs_g: 74,
      fat_g: 36,
    });
  });

  it("ignores slots with no options", () => {
    expect(dayTotals([slot("s1", 0, [])])).toEqual({
      kcal: 0,
      protein_g: 0,
      carbs_g: 0,
      fat_g: 0,
    });
  });
});

describe("slotTotals (components)", () => {
  it("sums separate components and ignores alternatives within a component", () => {
    const meal = slot("s1", 0, [
      // Component 0: sandwich + its alternative (only sandwich counts)
      option({ kcal: 320, protein_g: 20, carbs_g: 30, fat_g: 10 }, 0),
      option({ kcal: 999, protein_g: 1, carbs_g: 1, fat_g: 1 }, 0), // alt
      // Component 1: yogurt
      option({ kcal: 120, protein_g: 12, carbs_g: 8, fat_g: 4 }, 1),
      // Component 2: coffee
      option({ kcal: 60, protein_g: 2, carbs_g: 6, fat_g: 2 }, 2),
    ]);

    expect(slotTotals(meal)).toEqual({
      kcal: 500,
      protein_g: 34,
      carbs_g: 44,
      fat_g: 16,
    });
  });
});

describe("dayStatus", () => {
  it("is empty with no slots", () => {
    expect(dayStatus([])).toBe("empty");
  });

  it("is incomplete when a slot has no option", () => {
    expect(
      dayStatus([
        slot("s1", 0, [
          option({ kcal: 1, protein_g: 1, carbs_g: 1, fat_g: 1 }),
        ]),
        slot("s2", 0, []),
      ])
    ).toBe("incomplete");
  });

  it("is complete when every slot has an option", () => {
    expect(
      dayStatus([
        slot("s1", 0, [
          option({ kcal: 1, protein_g: 1, carbs_g: 1, fat_g: 1 }),
        ]),
      ])
    ).toBe("complete");
  });
});

describe("cycleMetrics", () => {
  const tree: CycleTree = {
    id: "c",
    name: "Test",
    client_id: 1,
    duration_days: 3,
    start_date: "2026-06-03",
    status: "active",
    slots: [
      slot("s1", 0, [
        option({ kcal: 1000, protein_g: 100, carbs_g: 100, fat_g: 30 }),
      ]),
      slot("s2", 1, [
        option({ kcal: 2000, protein_g: 140, carbs_g: 200, fat_g: 60 }),
      ]),
      // day 2 (index 2) is empty
    ],
  };

  it("averages over planned days only (empty days excluded)", () => {
    const m = cycleMetrics(tree);

    expect(m.avgKcal).toBe(1500); // (1000 + 2000) / 2 planned days
    expect(m.avgProtein).toBe(120);
    expect(m.totalDays).toBe(3);
    expect(m.plannedMeals).toBe(2);
    expect(m.completedDays).toBe(2);
  });
});
