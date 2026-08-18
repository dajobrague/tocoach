import type { MealCycleTree } from "@/lib/nutrition/cycles/meal-cycle-service";
import type { MealSlotOptionRow } from "@/lib/nutrition/cycles/meal-slot-option-service";

import { describe, expect, it } from "vitest";

import { buildTemplateDocument } from "../meal-cycle-template-service";

function option(overrides: Partial<MealSlotOptionRow> = {}): MealSlotOptionRow {
  return {
    id: "opt-1",
    slot_id: "slot-1",
    tenant_host: "tenant.example",
    source_type: "recipe",
    source_ref_id: "recipe-1",
    position: 0,
    group_index: 0,
    item_snapshot: {
      sourceType: "recipe",
      sourceRefId: "recipe-1",
      name: "Avena con fruta",
      steps: null,
      images: [],
      media: [],
      ingredients: [],
      totals: { kcal: 500, protein_g: 30, carbs_g: 60, fat_g: 12 },
    } as unknown as MealSlotOptionRow["item_snapshot"],
    created_at: "2026-08-01T00:00:00Z",
    updated_at: "2026-08-01T00:00:00Z",
    ...overrides,
  };
}

const tree: MealCycleTree = {
  id: "cycle-1",
  tenant_host: "tenant.example",
  trainer_id: "trainer-1",
  client_id: 7,
  name: "Definición",
  duration_days: 2,
  start_date: "2026-08-01",
  status: "active",
  day_targets: { "0": "preset-abc" },
  day_names: { "0": "Día de entreno" },
  created_at: "2026-08-01T00:00:00Z",
  updated_at: "2026-08-01T00:00:00Z",
  slots: [
    {
      id: "slot-1",
      cycle_id: "cycle-1",
      tenant_host: "tenant.example",
      day_index: 0,
      label: "Desayuno",
      position: 0,
      created_at: "2026-08-01T00:00:00Z",
      updated_at: "2026-08-01T00:00:00Z",
      options: [
        option(),
        option({
          id: "opt-2",
          source_ref_id: "recipe-2",
          group_index: null as unknown as number,
        }),
      ],
    },
  ],
};

describe("buildTemplateDocument", () => {
  it("captures duration, day names and the slots/options tree", () => {
    const doc = buildTemplateDocument(tree);

    expect(doc.version).toBe(1);
    expect(doc.duration_days).toBe(2);
    expect(doc.day_names).toEqual({ "0": "Día de entreno" });
    expect(doc.slots).toHaveLength(1);
    expect(doc.slots[0]?.label).toBe("Desayuno");
    expect(doc.slots[0]?.options.map((o) => o.source_ref_id)).toEqual([
      "recipe-1",
      "recipe-2",
    ]);
  });

  it("does not carry client-specific day_targets or row identifiers", () => {
    const doc = buildTemplateDocument(tree);
    const serialized = JSON.stringify(doc);

    expect(serialized).not.toContain("preset-abc");
    expect(serialized).not.toContain("cycle-1");
    expect(serialized).not.toContain("slot-1");
    expect(serialized).not.toContain("tenant.example");
  });

  it("defaults a missing group_index to 0 (pre-migration rows)", () => {
    const doc = buildTemplateDocument(tree);

    expect(doc.slots[0]?.options[1]?.group_index).toBe(0);
  });

  it("keeps the frozen snapshot verbatim", () => {
    const doc = buildTemplateDocument(tree);

    expect(doc.slots[0]?.options[0]?.item_snapshot).toEqual(
      tree.slots[0]?.options[0]?.item_snapshot
    );
  });
});
