import type { MealSlotWithOptions } from "@/lib/nutrition/cycles/meal-cycle-service";
import type { MealSlotOptionRow } from "@/lib/nutrition/cycles/meal-slot-option-service";

import { describe, expect, it } from "vitest";

import {
  chosenOption,
  dayPlannedTotals,
  withSelection,
  pctOf,
  slotComponents,
  slotPlannedTotals,
} from "@/components/client-dashboard/meal-cycle/slot-grouping";

function makeOption(
  id: string,
  groupIndex: number,
  kcal: number,
  protein = 0
): MealSlotOptionRow {
  return {
    id,
    slot_id: "slot-1",
    tenant_host: "t.example.com",
    source_type: "recipe",
    source_ref_id: "src",
    item_snapshot: {
      sourceType: "recipe",
      sourceRefId: "src",
      name: id,
      steps: null,
      images: [],
      media: [],
      ingredients: [],
      totals: {
        kcal,
        protein_g: protein,
        carbs_g: 0,
        fat_g: 0,
        sugar_g: 0,
        fiber_g: 0,
        sat_fat_g: 0,
        sodium_mg: 0,
      },
    },
    position: 0,
    group_index: groupIndex,
    created_at: "",
    updated_at: "",
  } as MealSlotOptionRow;
}

describe("slotComponents", () => {
  it("groups options by group_index, sorted, preserving option order", () => {
    const components = slotComponents([
      makeOption("b1", 1, 100),
      makeOption("a1", 0, 200),
      makeOption("a2", 0, 300),
    ]);

    expect(components.map((c) => c.groupIndex)).toEqual([0, 1]);
    expect(components[0]?.options.map((o) => o.id)).toEqual(["a1", "a2"]);
    expect(components[1]?.options.map((o) => o.id)).toEqual(["b1"]);
  });

  it("returns no components for an empty slot", () => {
    expect(slotComponents([])).toEqual([]);
  });
});

describe("chosenOption", () => {
  const component = {
    groupIndex: 0,
    options: [makeOption("first", 0, 100), makeOption("second", 0, 200)],
  };

  it("falls back to the first option without a selection", () => {
    expect(chosenOption(component, [])?.id).toBe("first");
  });

  it("honors a selection that points inside the component", () => {
    expect(chosenOption(component, ["second"])?.id).toBe("second");
  });

  it("ignores a selection that points at another component", () => {
    expect(chosenOption(component, ["elsewhere"])?.id).toBe("first");
  });

  it("picks the pick that belongs to this component among several", () => {
    expect(chosenOption(component, ["elsewhere", "second"])?.id).toBe("second");
  });
});

describe("withSelection", () => {
  // Component 0: a1 | a2 (alternatives); component 1: b1 | b2.
  const options = [
    makeOption("a1", 0, 100),
    makeOption("a2", 0, 100),
    makeOption("b1", 1, 100),
    makeOption("b2", 1, 100),
  ];

  it("keeps the pick of another component when choosing in this one", () => {
    const after = withSelection({ s1: ["a2"] }, options, "s1", "b2");

    expect(after.s1).toEqual(["a2", "b2"]);
  });

  it("replaces the previous pick of the same component", () => {
    const after = withSelection({ s1: ["a2", "b2"] }, options, "s1", "a1");

    expect(after.s1).toEqual(["b2", "a1"]);
  });

  it("does not touch other slots", () => {
    const after = withSelection({ s2: ["x"] }, options, "s1", "a1");

    expect(after).toEqual({ s2: ["x"], s1: ["a1"] });
  });
});

describe("slotPlannedTotals", () => {
  it("sums the chosen option of every component", () => {
    // Component 0: alternatives 200/300 kcal; component 1: single 100 kcal.
    const options = [
      makeOption("a1", 0, 200, 10),
      makeOption("a2", 0, 300, 20),
      makeOption("b1", 1, 100, 5),
    ];

    // Default (first of each group): 200 + 100.
    expect(slotPlannedTotals(options, []).kcal).toBe(300);
    expect(slotPlannedTotals(options, []).protein_g).toBe(15);

    // Selecting the alternative swaps only its component: 300 + 100.
    expect(slotPlannedTotals(options, ["a2"]).kcal).toBe(400);
  });
});

describe("dayPlannedTotals", () => {
  it("sums across slots using each slot's own selection", () => {
    const slots = [
      {
        id: "slot-1",
        options: [makeOption("a1", 0, 200), makeOption("a2", 0, 300)],
      },
      { id: "slot-2", options: [makeOption("c1", 0, 150)] },
    ] as unknown as MealSlotWithOptions[];

    expect(dayPlannedTotals(slots, {}).kcal).toBe(350);
    expect(dayPlannedTotals(slots, { "slot-1": ["a2"] }).kcal).toBe(450);
  });
});

describe("pctOf", () => {
  it("computes a clamped rounded percentage", () => {
    expect(pctOf(50, 200)).toBe(25);
    expect(pctOf(500, 200)).toBe(100);
    expect(pctOf(10, 0)).toBe(0);
  });
});
