import type { MealCycleTree, MealSlotWithOptions } from "../meal-cycle-service";
import type { MealSlotOptionRow } from "../meal-slot-option-service";
import type { OptionSnapshot } from "../option-snapshot";
import type { OverrideRow } from "../override-types";

import { describe, expect, it } from "vitest";

import { resolveOverridesForDate } from "../override-resolution";

/**
 * Resolution is the heart of the slice — exhaustive, DB-free. The reviewer
 * checks scope precedence and that the FROZEN swap_snapshot is used (never a
 * live recipe read), so those are exercised hardest.
 */

function snapshot(name: string): OptionSnapshot {
  return {
    sourceType: "recipe",
    sourceRefId: "r1",
    name,
    steps: null,
    images: [],
    media: [],
    ingredients: [],
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
  };
}

function option(id: string): MealSlotOptionRow {
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
    item_snapshot: snapshot(`base ${id}`),
  };
}

function slot(
  id: string,
  dayIndex: number,
  options: MealSlotOptionRow[]
): MealSlotWithOptions {
  return {
    id,
    cycle_id: "cycle-1",
    tenant_host: "t.local",
    day_index: dayIndex,
    label: id,
    position: 0,
    created_at: "2026-06-01T00:00:00Z",
    updated_at: "2026-06-01T00:00:00Z",
    options,
  };
}

function tree(
  slots: MealSlotWithOptions[],
  durationDays = 2,
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

let seq = 0;

function override(partial: Partial<OverrideRow>): OverrideRow {
  seq += 1;

  return {
    id: `ov-${seq}`,
    tenant_host: "t.local",
    cycle_id: "cycle-1",
    client_id: 1,
    override_type: "note",
    scope: "single_day",
    anchor_date: "2026-06-01",
    day_index: null,
    slot_id: null,
    note_text: null,
    swap_source_type: null,
    swap_source_ref_id: null,
    swap_snapshot: null,
    swap_snapshots: null,
    created_at: "2026-06-01T00:00:00Z",
    updated_at: "2026-06-01T00:00:00Z",
    ...partial,
  };
}

function noteOverride(partial: Partial<OverrideRow>): OverrideRow {
  return override({ override_type: "note", note_text: "n", ...partial });
}

function swapOverride(
  slotId: string,
  snap: OptionSnapshot,
  partial: Partial<OverrideRow>
): OverrideRow {
  return override({
    override_type: "swap",
    slot_id: slotId,
    swap_source_type: "recipe",
    swap_source_ref_id: "swapped-recipe",
    swap_snapshot: snap,
    ...partial,
  });
}

const TWO_DAY = () =>
  tree([
    slot("s0", 0, [option("o0a"), option("o0b")]),
    slot("s1", 0, [option("o1a")]),
    slot("s2", 1, [option("o2a")]),
  ]);

describe("resolveOverridesForDate — rotation day + empties", () => {
  it("maps the date to its rotation day index", () => {
    expect(resolveOverridesForDate(TWO_DAY(), [], "2026-06-01").dayIndex).toBe(
      0
    );
    expect(resolveOverridesForDate(TWO_DAY(), [], "2026-06-02").dayIndex).toBe(
      1
    );
    expect(resolveOverridesForDate(TWO_DAY(), [], "2026-06-03").dayIndex).toBe(
      0
    );
  });

  it("returns the day's base slots with no swaps when there are no overrides", () => {
    const day = resolveOverridesForDate(TWO_DAY(), [], "2026-06-01");

    expect(day.slots.map((s) => s.slotId)).toEqual(["s0", "s1"]);
    expect(day.slots.every((s) => s.swap === null)).toBe(true);
    expect(day.notes).toEqual([]);
  });

  it("a null cycle resolves to an empty day", () => {
    const day = resolveOverridesForDate(null, [], "2026-06-01");

    expect(day).toEqual({
      date: "2026-06-01",
      dayIndex: null,
      slots: [],
      notes: [],
    });
  });
});

describe("resolveOverridesForDate — scope predicates in isolation", () => {
  it("single_day applies only on its anchor date", () => {
    const ov = noteOverride({ scope: "single_day", anchor_date: "2026-06-03" });

    expect(
      resolveOverridesForDate(TWO_DAY(), [ov], "2026-06-03").notes
    ).toHaveLength(1);
    expect(
      resolveOverridesForDate(TWO_DAY(), [ov], "2026-06-01").notes
    ).toHaveLength(0);
  });

  it("day_forward applies on the anchor and every later date, not before", () => {
    const ov = noteOverride({
      scope: "day_forward",
      anchor_date: "2026-06-02",
    });

    expect(
      resolveOverridesForDate(TWO_DAY(), [ov], "2026-06-01").notes
    ).toHaveLength(0);
    expect(
      resolveOverridesForDate(TWO_DAY(), [ov], "2026-06-02").notes
    ).toHaveLength(1);
    expect(
      resolveOverridesForDate(TWO_DAY(), [ov], "2026-06-09").notes
    ).toHaveLength(1);
  });

  it("every_cycle applies on every rotation day whose index matches", () => {
    // day_index 0 → applies on 06-01 (idx 0) and 06-03 (idx 0), not 06-02 (idx 1).
    const ov = noteOverride({
      scope: "every_cycle",
      day_index: 0,
      anchor_date: "2026-06-01",
    });

    expect(
      resolveOverridesForDate(TWO_DAY(), [ov], "2026-06-01").notes
    ).toHaveLength(1);
    expect(
      resolveOverridesForDate(TWO_DAY(), [ov], "2026-06-03").notes
    ).toHaveLength(1);
    expect(
      resolveOverridesForDate(TWO_DAY(), [ov], "2026-06-02").notes
    ).toHaveLength(0);
  });
});

describe("resolveOverridesForDate — swap precedence (most-specific wins)", () => {
  const DATE = "2026-06-03"; // rotation day index 0

  it("single_day beats day_forward beats every_cycle on the same slot", () => {
    const single = swapOverride("s0", snapshot("SINGLE"), {
      scope: "single_day",
      anchor_date: DATE,
      created_at: "2026-06-01T00:00:00Z",
    });
    const forward = swapOverride("s0", snapshot("FORWARD"), {
      scope: "day_forward",
      anchor_date: "2026-06-01",
      created_at: "2026-06-02T00:00:00Z",
    });
    const every = swapOverride("s0", snapshot("EVERY"), {
      scope: "every_cycle",
      day_index: 0,
      created_at: "2026-06-02T12:00:00Z",
    });

    const day = resolveOverridesForDate(
      TWO_DAY(),
      [every, forward, single],
      DATE
    );
    const s0 = day.slots.find((s) => s.slotId === "s0");

    expect(s0?.swap?.overrideId).toBe(single.id);
    expect(s0?.swap?.snapshots[0]?.name).toBe("SINGLE");
  });

  it("day_forward beats every_cycle when no single_day is present", () => {
    const forward = swapOverride("s0", snapshot("FORWARD"), {
      scope: "day_forward",
      anchor_date: "2026-06-01",
    });
    const every = swapOverride("s0", snapshot("EVERY"), {
      scope: "every_cycle",
      day_index: 0,
    });

    const day = resolveOverridesForDate(TWO_DAY(), [every, forward], DATE);

    expect(
      day.slots.find((s) => s.slotId === "s0")?.swap?.snapshots[0]?.name
    ).toBe("FORWARD");
  });

  it("ties within the same scope go to the latest created_at", () => {
    const older = swapOverride("s0", snapshot("OLDER"), {
      scope: "single_day",
      anchor_date: DATE,
      created_at: "2026-06-01T00:00:00Z",
    });
    const newer = swapOverride("s0", snapshot("NEWER"), {
      scope: "single_day",
      anchor_date: DATE,
      created_at: "2026-06-02T00:00:00Z",
    });

    const day = resolveOverridesForDate(TWO_DAY(), [older, newer], DATE);

    expect(day.slots.find((s) => s.slotId === "s0")?.swap?.overrideId).toBe(
      newer.id
    );
  });
});

describe("resolveOverridesForDate — independence", () => {
  it("a swap on one slot leaves sibling slots untouched", () => {
    const swap = swapOverride("s0", snapshot("SWAP"), {
      scope: "single_day",
      anchor_date: "2026-06-01",
    });

    const day = resolveOverridesForDate(TWO_DAY(), [swap], "2026-06-01");
    const s0 = day.slots.find((s) => s.slotId === "s0");
    const s1 = day.slots.find((s) => s.slotId === "s1");

    expect(s0?.swap?.snapshots[0]?.name).toBe("SWAP");
    expect(s1?.swap).toBeNull();
    expect(s1?.options.map((o) => o.id)).toEqual(["o1a"]);
  });

  it("notes and swaps are resolved independently on the same date", () => {
    const note = noteOverride({
      scope: "single_day",
      anchor_date: "2026-06-01",
      note_text: "Extra agua hoy",
    });
    const swap = swapOverride("s0", snapshot("SWAP"), {
      scope: "single_day",
      anchor_date: "2026-06-01",
    });

    const day = resolveOverridesForDate(TWO_DAY(), [note, swap], "2026-06-01");

    expect(day.notes).toHaveLength(1);
    expect(day.notes[0]?.text).toBe("Extra agua hoy");
    expect(
      day.slots.find((s) => s.slotId === "s0")?.swap?.snapshots[0]?.name
    ).toBe("SWAP");
  });
});

describe("resolveOverridesForDate — before cycle start", () => {
  it("a date before start has no rotation day and no slots; every_cycle cannot apply", () => {
    const every = swapOverride("s0", snapshot("EVERY"), {
      scope: "every_cycle",
      day_index: 0,
    });

    const day = resolveOverridesForDate(TWO_DAY(), [every], "2026-05-30");

    expect(day.dayIndex).toBeNull();
    expect(day.slots).toEqual([]);
  });
});

describe("resolveOverridesForDate — frozen snapshot is used (no live read)", () => {
  it("returns the override's own frozen swap_snapshot by identity", () => {
    const frozen = snapshot("FROZEN-AT-WRITE");
    const swap = swapOverride("s0", frozen, {
      scope: "single_day",
      anchor_date: "2026-06-01",
    });

    const day = resolveOverridesForDate(TWO_DAY(), [swap], "2026-06-01");

    // Identity: resolution hands back the frozen object — it never reads a recipe.
    expect(day.slots.find((s) => s.slotId === "s0")?.swap?.snapshots[0]).toBe(
      frozen
    );
  });
});
