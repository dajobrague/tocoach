import type { ClientWeekDay } from "@/lib/nutrition/cycles/client-week";
import type { MealSlotWithOptions } from "@/lib/nutrition/cycles/meal-cycle-service";
import type { MealSlotOptionRow } from "@/lib/nutrition/cycles/meal-slot-option-service";
import type { SnapshotIngredient } from "@/lib/nutrition/cycles/option-snapshot";

import { describe, expect, it } from "vitest";

import {
  aggregatePickedMeals,
  defaultOptionId,
  mealKey,
  picksFromMap,
} from "../shopping-wizard-helpers";

/** Wizard aggregation: picked-only, merge/sum, units never cross-merge. */

function ingredient(
  name: string,
  quantity: number,
  unit = "g"
): SnapshotIngredient {
  return { name, quantity, unit, gramsPerUnit: null, nutrientsPer100g: {} };
}

function option(
  id: string,
  name: string,
  ingredients: SnapshotIngredient[]
): MealSlotOptionRow {
  return {
    id,
    slot_id: "ignored",
    tenant_host: "t.local",
    source_type: "recipe",
    source_ref_id: "r1",
    position: 0,
    group_index: 0,
    created_at: "2026-06-01T00:00:00Z",
    updated_at: "2026-06-01T00:00:00Z",
    item_snapshot: {
      sourceType: "recipe",
      sourceRefId: "r1",
      name,
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

function slot(id: string, options: MealSlotOptionRow[]): MealSlotWithOptions {
  return {
    id,
    cycle_id: "cycle-1",
    tenant_host: "t.local",
    day_index: 0,
    label: id,
    position: 0,
    created_at: "2026-06-01T00:00:00Z",
    updated_at: "2026-06-01T00:00:00Z",
    options,
  };
}

function day(date: string, slots: MealSlotWithOptions[]): ClientWeekDay {
  return {
    date,
    started: true,
    dayIndex: 0,
    slots,
    notes: [],
    logs: {},
    canLog: true,
  };
}

/** Two days; day 1 has Avena(oats+milk-ml) & Pollo; day 2 has Avena again. */
function week(): ClientWeekDay[] {
  return [
    day("2026-06-08", [
      slot("s1", [
        option("avena", "Avena", [
          ingredient("Oats", 50),
          ingredient("Milk", 200, "ml"),
        ]),
        option("pollo", "Pollo", [ingredient("Chicken", 150)]),
      ]),
    ]),
    day("2026-06-09", [
      slot("s2", [option("avena2", "Avena", [ingredient("Oats", 50)])]),
    ]),
  ];
}

describe("mealKey / picksFromMap", () => {
  it("round-trips a picks map into resolved picks", () => {
    const map = { [mealKey("2026-06-08", "s1")]: "avena" };

    expect(picksFromMap(map)).toEqual([
      { date: "2026-06-08", slotId: "s1", optionId: "avena" },
    ]);
  });
});

describe("defaultOptionId", () => {
  it("prefers the standing selection when it's an option here", () => {
    const s = slot("s1", [option("a", "A", []), option("b", "B", [])]);

    expect(defaultOptionId(s, { s1: "b" })).toBe("b");
  });

  it("falls back to the first option otherwise", () => {
    const s = slot("s1", [option("a", "A", []), option("b", "B", [])]);

    expect(defaultOptionId(s, {})).toBe("a");
    expect(defaultOptionId(s, { s1: "ghost" })).toBe("a");
  });
});

describe("aggregatePickedMeals", () => {
  it("aggregates ONLY the picked meals", () => {
    // Pick only day-1 Avena → its oats + milk; nothing else.
    const items = aggregatePickedMeals(week(), [
      { date: "2026-06-08", slotId: "s1", optionId: "avena" },
    ]);

    expect(items).toEqual([
      { name: "Milk", brand: null, unit: "ml", quantity: 200 },
      { name: "Oats", brand: null, unit: "g", quantity: 50 },
    ]);
  });

  it("returns [] when nothing is picked", () => {
    expect(aggregatePickedMeals(week(), [])).toEqual([]);
  });

  it("sums the same ingredient across two picked days", () => {
    const items = aggregatePickedMeals(week(), [
      { date: "2026-06-08", slotId: "s1", optionId: "avena" },
      { date: "2026-06-09", slotId: "s2", optionId: "avena2" },
    ]);

    // Oats 50 + 50 = 100 (merged); Milk only on day 1 (units stay separate).
    expect(items).toEqual([
      { name: "Milk", brand: null, unit: "ml", quantity: 200 },
      { name: "Oats", brand: null, unit: "g", quantity: 100 },
    ]);
  });

  it("uses the picked option (not a sibling) for a multi-option meal", () => {
    const items = aggregatePickedMeals(week(), [
      { date: "2026-06-08", slotId: "s1", optionId: "pollo" },
    ]);

    expect(items).toEqual([
      { name: "Chicken", brand: null, unit: "g", quantity: 150 },
    ]);
  });

  it("keeps a g and an ml line of the same name separate", () => {
    const items = aggregatePickedMeals(
      [
        day("2026-06-08", [
          slot("s1", [
            option("o", "Mix", [
              ingredient("Milk", 100, "g"),
              ingredient("Milk", 200, "ml"),
            ]),
          ]),
        ]),
      ],
      [{ date: "2026-06-08", slotId: "s1", optionId: "o" }]
    );

    expect(items).toEqual([
      { name: "Milk", brand: null, unit: "g", quantity: 100 },
      { name: "Milk", brand: null, unit: "ml", quantity: 200 },
    ]);
  });

  it("falls back to the first option when the picked option id is gone", () => {
    // Simulates a swap: the resolved slot has one (frozen) option whose id the
    // stored pick no longer matches → fall back to first → swapped ingredients.
    const swapped = [
      day("2026-06-08", [
        slot("s1", [
          option("override-x", "Swapped", [ingredient("Tofu", 120)]),
        ]),
      ]),
    ];

    const items = aggregatePickedMeals(swapped, [
      { date: "2026-06-08", slotId: "s1", optionId: "stale-old-id" },
    ]);

    expect(items).toEqual([
      { name: "Tofu", brand: null, unit: "g", quantity: 120 },
    ]);
  });
});
