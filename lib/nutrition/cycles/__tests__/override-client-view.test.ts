import type { ClientCycleView } from "../cycle-day";
import type { MealCycleTree, MealSlotWithOptions } from "../meal-cycle-service";
import type { MealSlotOptionRow } from "../meal-slot-option-service";
import type { OptionSnapshot } from "../option-snapshot";
import type { OverrideRow } from "../override-types";

import { describe, expect, it } from "vitest";

import { buildClientCycleView } from "../cycle-day";
import { applyOverridesToClientView } from "../override-client-view";

/** Folding overrides into the client today view (P7-T4) — pure, no DOM. */

function snapshot(name: string): OptionSnapshot {
  return {
    sourceType: "recipe",
    sourceRefId: "swapped-ref",
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

function slot(id: string, dayIndex: number): MealSlotWithOptions {
  return {
    id,
    cycle_id: "cycle-1",
    tenant_host: "t.local",
    day_index: dayIndex,
    label: id,
    position: 0,
    created_at: "2026-06-01T00:00:00Z",
    updated_at: "2026-06-01T00:00:00Z",
    options: [option(`${id}-a`), option(`${id}-b`)],
  };
}

function tree(): MealCycleTree {
  return {
    id: "cycle-1",
    tenant_host: "t.local",
    trainer_id: "trainer-1",
    client_id: 1,
    name: "Plan",
    duration_days: 2,
    start_date: "2026-06-01",
    status: "active",
    day_targets: {},
    day_names: {},
    created_at: "2026-06-01T00:00:00Z",
    updated_at: "2026-06-01T00:00:00Z",
    slots: [slot("s0", 0), slot("s1", 0), slot("s2", 1)],
  };
}

let seq = 0;

function ov(partial: Partial<OverrideRow>): OverrideRow {
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

/** Build today's base view for 2026-06-01 (rotation day 0). */
function baseView(): ClientCycleView {
  return buildClientCycleView(tree(), "2026-06-01", "UTC");
}

describe("applyOverridesToClientView", () => {
  it("attaches today's date-level note", () => {
    const note = ov({ note_text: "Bebe más agua hoy" });

    const view = applyOverridesToClientView(
      baseView(),
      tree(),
      [note],
      "2026-06-01"
    );

    expect(view.notes).toEqual([
      { id: note.id, slotId: null, text: "Bebe más agua hoy" },
    ]);
  });

  it("replaces a swapped slot's options with the frozen snapshot", () => {
    const frozen = snapshot("Comida intercambiada");
    const swap = ov({
      override_type: "swap",
      slot_id: "s0",
      swap_source_type: "recipe",
      swap_source_ref_id: "swapped-ref",
      swap_snapshot: frozen,
    });

    const view = applyOverridesToClientView(
      baseView(),
      tree(),
      [swap],
      "2026-06-01"
    );
    const day0 = view.days.find((d) => d.dayIndex === 0)!;
    const s0 = day0.slots.find((s) => s.id === "s0")!;
    const s1 = day0.slots.find((s) => s.id === "s1")!;

    // s0 now shows exactly the frozen swap; siblings untouched.
    expect(s0.options).toHaveLength(1);
    expect(s0.options[0]?.item_snapshot).toBe(frozen);
    expect(s0.options[0]?.item_snapshot.name).toBe("Comida intercambiada");
    expect(s1.options.map((o) => o.id)).toEqual(["s1-a", "s1-b"]);
  });

  it("does not apply a swap that targets a different date", () => {
    const swap = ov({
      override_type: "swap",
      scope: "single_day",
      anchor_date: "2026-06-02", // not today (06-01)
      slot_id: "s0",
      swap_source_type: "recipe",
      swap_source_ref_id: "swapped-ref",
      swap_snapshot: snapshot("Otro día"),
    });

    const view = applyOverridesToClientView(
      baseView(),
      tree(),
      [swap],
      "2026-06-01"
    );
    const s0 = view.days
      .find((d) => d.dayIndex === 0)!
      .slots.find((s) => s.id === "s0")!;

    expect(s0.options.map((o) => o.id)).toEqual(["s0-a", "s0-b"]);
    expect(view.notes).toEqual([]);
  });

  it("is a no-op when there is no cycle", () => {
    const empty = buildClientCycleView(null, "2026-06-01");

    expect(applyOverridesToClientView(empty, null, [], "2026-06-01")).toBe(
      empty
    );
  });
});
