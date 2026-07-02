import type { IngredientRow } from "../ingredient-repository";
import type { FoodResult } from "../types";

import { describe, expect, it } from "vitest";

import { foodResultToInsert, rowToFoodResult } from "../ingredient-repository";

const TENANT = "nutrition-v2-test.local";

function makeRow(overrides: Partial<IngredientRow> = {}): IngredientRow {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    tenant_host: TENANT,
    source: "off",
    source_ref: "0123",
    name: "Greek Yogurt",
    brand: "Fage",
    image_url: "https://img.test/0123.200.jpg",
    default_unit: "g",
    kcal: 97,
    protein_g: 10,
    carbs_g: 3.6,
    fat_g: 5,
    sugar_g: 3.6,
    fiber_g: 0,
    sat_fat_g: 3.3,
    sodium_mg: 50,
    nutrient_extra: {},
    created_by: null,
    created_at: "2026-06-02T00:00:00Z",
    updated_at: "2026-06-02T00:00:00Z",
    ...overrides,
  };
}

function makeResult(overrides: Partial<FoodResult> = {}): FoodResult {
  return {
    source: "off",
    sourceRef: "0123",
    name: "Greek Yogurt",
    defaultUnit: "g",
    nutrientsPer100g: {
      kcal: 97,
      protein_g: 10,
      carbs_g: 3.6,
      fat_g: 5,
      sugar_g: 3.6,
      fiber_g: 0,
      sat_fat_g: 3.3,
      sodium_mg: 50,
    },
    ...overrides,
  };
}

describe("rowToFoodResult", () => {
  it("maps a cached image_url to imageUrl", () => {
    const result = rowToFoodResult(makeRow());

    expect(result.imageUrl).toBe("https://img.test/0123.200.jpg");
  });

  it("leaves imageUrl absent when the row has no image", () => {
    const result = rowToFoodResult(makeRow({ image_url: null }));

    expect("imageUrl" in result).toBe(false);
  });
});

describe("foodResultToInsert", () => {
  it("persists imageUrl into the image_url column", () => {
    const insert = foodResultToInsert(
      TENANT,
      makeResult({ imageUrl: "https://img.test/0123.200.jpg" })
    );

    expect(insert.image_url).toBe("https://img.test/0123.200.jpg");
  });

  it("omits image_url when the result has no image", () => {
    const insert = foodResultToInsert(TENANT, makeResult());

    expect("image_url" in insert).toBe(false);
  });
});
