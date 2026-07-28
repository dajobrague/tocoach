import type { OptionSnapshot } from "@/lib/nutrition/cycles/option-snapshot";

import { describe, expect, it } from "vitest";

import { EMPTY_TOTALS, normalizeOptionSnapshot } from "../normalize-snapshot";

/**
 * An option frozen before the `media` field existed: it has photos, steps,
 * ingredients and totals, but NO `media` key at all. Cast through `unknown`
 * because the compile-time type now requires `media` — runtime rows from older
 * writes do not have it.
 */
const PRE_MEDIA_SNAPSHOT = {
  sourceType: "recipe",
  sourceRefId: "recipe-1",
  name: "Avena con leche",
  steps: "Mezclar y servir.",
  images: [{ url: "https://cdn/oats.jpg", orientation: "horizontal" }],
  ingredients: [
    {
      name: "Avena",
      quantity: 100,
      unit: "g",
      nutrientsPer100g: { kcal: 380 },
    },
  ],
  totals: {
    kcal: 380,
    protein_g: 13,
    carbs_g: 67,
    fat_g: 7,
    sugar_g: 1,
    fiber_g: 10,
    sat_fat_g: 1,
    sodium_mg: 5,
  },
} as unknown as OptionSnapshot;

describe("normalizeOptionSnapshot", () => {
  it("defaults media to [] for a pre-media snapshot, keeping its other content", () => {
    const result = normalizeOptionSnapshot(PRE_MEDIA_SNAPSHOT);

    // The new field a legacy row lacks → safe empty array (no video, no crash).
    expect(result.media).toEqual([]);
    // Everything the legacy row *does* have is preserved.
    expect(result.images).toEqual([
      { url: "https://cdn/oats.jpg", orientation: "horizontal" },
    ]);
    expect(result.ingredients).toEqual([
      {
        name: "Avena",
        quantity: 100,
        unit: "g",
        nutrientsPer100g: { kcal: 380 },
      },
    ]);
    expect(result.steps).toBe("Mezclar y servir.");
    expect(result.totals.kcal).toBe(380);
    expect(result.name).toBe("Avena con leche");
    expect(result.sourceType).toBe("recipe");
    // Fields added after this row was frozen → safe nulls.
    expect(result.description).toBeNull();
    expect(result.trainerComment).toBeNull();
  });

  it("returns fully safe defaults for a null/undefined snapshot", () => {
    const result = normalizeOptionSnapshot(undefined);

    expect(result).toEqual({
      sourceType: "recipe",
      name: "",
      brand: null,
      steps: null,
      description: null,
      trainerComment: null,
      images: [],
      media: [],
      ingredients: [],
      totals: EMPTY_TOTALS,
    });
  });

  it("surfaces the food's brand from its ingredient line", () => {
    const result = normalizeOptionSnapshot({
      sourceType: "food",
      name: "Yogur griego ligero",
      ingredients: [
        {
          name: "Yogur griego ligero",
          brand: "Hacendado",
          quantity: 250,
          unit: "g",
          gramsPerUnit: null,
          nutrientsPer100g: {},
        },
      ],
    });

    expect(result.brand).toBe("Hacendado");
  });

  it("keeps brand null for recipes even when lines are branded", () => {
    const result = normalizeOptionSnapshot({
      sourceType: "recipe",
      name: "Bol de yogur",
      ingredients: [
        {
          name: "Yogur griego",
          brand: "Hacendado",
          quantity: 250,
          unit: "g",
          gramsPerUnit: null,
          nutrientsPer100g: {},
        },
      ],
    });

    expect(result.brand).toBeNull();
  });
});
