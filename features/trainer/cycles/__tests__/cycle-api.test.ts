import type { CycleSlot, SlotOption } from "../cycle-api";

import { describe, expect, it } from "vitest";

import {
  buildAddOptionBody,
  groupSlotsByDay,
  optionKcal,
  resolveRelabel,
} from "../cycle-api";

function slot(over: Partial<CycleSlot> = {}): CycleSlot {
  return {
    id: "s",
    cycle_id: "c",
    day_index: 0,
    label: "",
    position: 0,
    options: [],
    ...over,
  };
}

describe("groupSlotsByDay", () => {
  it("buckets slots per day and orders each by position", () => {
    const days = groupSlotsByDay(
      [
        slot({ id: "a", day_index: 0, position: 1 }),
        slot({ id: "b", day_index: 0, position: 0 }),
        slot({ id: "c", day_index: 2, position: 0 }),
      ],
      3
    );

    expect(days).toHaveLength(3);
    expect(days[0]?.slots.map((s) => s.id)).toEqual(["b", "a"]);
    expect(days[1]?.slots).toEqual([]);
    expect(days[2]?.slots.map((s) => s.id)).toEqual(["c"]);
  });

  it("drops slots whose day_index is outside the duration", () => {
    const days = groupSlotsByDay([slot({ id: "x", day_index: 5 })], 2);

    expect(days).toHaveLength(2);
    expect(days.flatMap((d) => d.slots)).toEqual([]);
  });

  it("returns no days for a zero/negative duration", () => {
    expect(groupSlotsByDay([slot()], 0)).toEqual([]);
  });
});

describe("optionKcal", () => {
  it("reads + rounds kcal from the frozen snapshot", () => {
    const option = {
      item_snapshot: { totals: { kcal: 166.6667 } },
    } as unknown as SlotOption;

    expect(optionKcal(option)).toBe(167);
  });

  it("defaults to 0 when the snapshot has no totals", () => {
    expect(optionKcal({ item_snapshot: {} } as unknown as SlotOption)).toBe(0);
  });
});

describe("resolveRelabel", () => {
  it("returns the trimmed label when changed", () => {
    expect(resolveRelabel("  Desayuno  ", "Comida")).toEqual({
      label: "Desayuno",
    });
  });

  it("returns null for an empty or whitespace-only label (keeps previous)", () => {
    expect(resolveRelabel("", "Comida")).toBeNull();
    expect(resolveRelabel("   ", "Comida")).toBeNull();
  });

  it("returns null when the value is unchanged (no-op)", () => {
    expect(resolveRelabel("Comida", "Comida")).toBeNull();
    expect(resolveRelabel("  Comida  ", "Comida")).toBeNull();
  });
});

describe("buildAddOptionBody", () => {
  it("builds a recipe option body", () => {
    expect(buildAddOptionBody({ kind: "recipe", recipeId: "r1" })).toEqual({
      source_type: "recipe",
      recipe_id: "r1",
    });
  });

  it("builds a food option body with quantity", () => {
    expect(
      buildAddOptionBody({ kind: "food", ingredientId: "i1", quantity: 120 })
    ).toEqual({
      source_type: "food",
      ingredient_id: "i1",
      quantity: 120,
    });
  });
});
