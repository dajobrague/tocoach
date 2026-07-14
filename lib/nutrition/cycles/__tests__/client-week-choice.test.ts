import type { MealCycleTree } from "../meal-cycle-service";
import type { OptionSnapshot } from "../option-snapshot";
import type { OverrideRow } from "../override-types";

import { describe, expect, it } from "vitest";

import { buildClientWeek } from "../client-week";
import { resolveOverridesForDate } from "../override-resolution";

/** 3-day plan starting Monday 2026-07-06; day 0 named, one empty slot per day. */
function tree(): MealCycleTree {
  const slot = (id: string, dayIndex: number) => ({
    id,
    cycle_id: "cycle-1",
    tenant_host: "t.local",
    day_index: dayIndex,
    label: "Desayuno",
    position: 0,
    created_at: "2026-07-01T00:00:00Z",
    updated_at: "2026-07-01T00:00:00Z",
    options: [],
  });

  return {
    id: "cycle-1",
    tenant_host: "t.local",
    trainer_id: "trainer-1",
    client_id: 1,
    name: "Plan",
    duration_days: 3,
    start_date: "2026-07-06",
    status: "active",
    day_targets: {},
    day_names: { "0": "Día de entreno" },
    created_at: "2026-07-01T00:00:00Z",
    updated_at: "2026-07-01T00:00:00Z",
    slots: [slot("s0", 0), slot("s1", 1), slot("s2", 2)],
  };
}

describe("buildClientWeek — menu choices", () => {
  it("follows the rotation when there is no choice", () => {
    const week = buildClientWeek(tree(), [], [], "2026-07-06", "2026-07-08");
    const tuesday = week.days[1]!;

    expect(tuesday.dayIndex).toBe(1);
    expect(tuesday.recommendedDayIndex).toBe(1);
    expect(tuesday.hasMenuChoice).toBe(false);
    expect(tuesday.isMenuChoice).toBe(false);
    expect(tuesday.dayName).toBeNull();
  });

  it("a valid choice beats the recommendation and carries the menu name", () => {
    const week = buildClientWeek(
      tree(),
      [],
      [],
      "2026-07-06",
      "2026-07-08",
      "UTC",
      [],
      { "2026-07-07": 0 }
    );
    const tuesday = week.days[1]!;

    expect(tuesday.dayIndex).toBe(0);
    expect(tuesday.recommendedDayIndex).toBe(1);
    expect(tuesday.hasMenuChoice).toBe(true);
    expect(tuesday.isMenuChoice).toBe(true);
    expect(tuesday.dayName).toBe("Día de entreno");
    expect(tuesday.slots[0]?.id).toBe("s0");
  });

  it("a confirmed choice equal to the recommendation still counts as chosen", () => {
    const week = buildClientWeek(
      tree(),
      [],
      [],
      "2026-07-06",
      "2026-07-08",
      "UTC",
      [],
      { "2026-07-07": 1 }
    );
    const tuesday = week.days[1]!;

    expect(tuesday.dayIndex).toBe(1);
    expect(tuesday.hasMenuChoice).toBe(true);
    expect(tuesday.isMenuChoice).toBe(false);
  });

  it("an out-of-range choice falls back to the recommendation", () => {
    const week = buildClientWeek(
      tree(),
      [],
      [],
      "2026-07-06",
      "2026-07-08",
      "UTC",
      [],
      { "2026-07-08": 9 }
    );
    const wednesday = week.days[2]!;

    expect(wednesday.dayIndex).toBe(2);
    expect(wednesday.isMenuChoice).toBe(false);
  });

  it("lists every menu of the plan with name, kcal and meal preview", () => {
    const week = buildClientWeek(tree(), [], [], "2026-07-06", "2026-07-08");

    const emptyMeal = {
      label: "Desayuno",
      primaryName: null,
      optionCount: 0,
    };

    expect(week.menus).toEqual([
      {
        dayIndex: 0,
        name: "Día de entreno",
        kcal: 0,
        meals: [emptyMeal],
        images: [],
      },
      { dayIndex: 1, name: null, kcal: 0, meals: [emptyMeal], images: [] },
      { dayIndex: 2, name: null, kcal: 0, meals: [emptyMeal], images: [] },
    ]);
  });

  it("resolves overrides against the CHOSEN day, not the rotation's", () => {
    const snapshot = {
      sourceType: "food",
      sourceRefId: "food-1",
      name: "Swap",
      steps: null,
      images: [],
      media: [],
      ingredients: [],
      totals: { kcal: 100, protein_g: 0, carbs_g: 0, fat_g: 0 },
    } as unknown as OptionSnapshot;
    // A single-day swap on Tuesday targeting day 0's slot — it only shows if
    // resolution follows the client's choice (day 0) instead of rotation day 1.
    const override: OverrideRow = {
      id: "ov-1",
      tenant_host: "t.local",
      cycle_id: "cycle-1",
      client_id: 1,
      override_type: "swap",
      scope: "single_day",
      anchor_date: "2026-07-07",
      day_index: null,
      slot_id: "s0",
      note_text: null,
      swap_source_type: "food",
      swap_source_ref_id: "food-1",
      swap_snapshot: null,
      swap_snapshots: [snapshot],
      created_at: "2026-07-01T00:00:00Z",
      updated_at: "2026-07-01T00:00:00Z",
    };

    const effective = resolveOverridesForDate(
      tree(),
      [override],
      "2026-07-07",
      "UTC",
      0
    );

    expect(effective.dayIndex).toBe(0);
    expect(effective.slots[0]?.slotId).toBe("s0");
    expect(effective.slots[0]?.swap?.snapshots[0]?.name).toBe("Swap");
  });

  it("ignores an out-of-range day override in resolution", () => {
    const effective = resolveOverridesForDate(
      tree(),
      [],
      "2026-07-07",
      "UTC",
      9
    );

    expect(effective.dayIndex).toBe(1);
  });

  it("returns no menus and keeps days not-started without a cycle", () => {
    const week = buildClientWeek(null, [], [], "2026-07-06", "2026-07-08");

    expect(week.menus).toEqual([]);
    expect(week.days[0]?.started).toBe(false);
    expect(week.days[0]?.recommendedDayIndex).toBeNull();
  });
});
