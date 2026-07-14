import type { NutrientsPer100g } from "@/lib/nutrition/food-source";
import type { NutrientTotals } from "../macro-rollup";

import { describe, expect, it } from "vitest";

import { rollupRecipeTotals } from "../macro-rollup";

const oatsPer100g: NutrientsPer100g = {
  kcal: 389,
  protein_g: 16.9,
  carbs_g: 66.3,
  fat_g: 6.9,
  sugar_g: 0,
  fiber_g: 10.6,
  sat_fat_g: 1.2,
  sodium_mg: 2,
};

function zeros(): NutrientTotals {
  return {
    kcal: 0,
    protein_g: 0,
    carbs_g: 0,
    fat_g: 0,
    sugar_g: 0,
    fiber_g: 0,
    sat_fat_g: 0,
    sodium_mg: 0,
  };
}

function scaled(per100g: NutrientsPer100g, grams: number): NutrientTotals {
  const factor = grams / 100;

  return {
    kcal: per100g.kcal * factor,
    protein_g: per100g.protein_g * factor,
    carbs_g: per100g.carbs_g * factor,
    fat_g: per100g.fat_g * factor,
    sugar_g: per100g.sugar_g * factor,
    fiber_g: per100g.fiber_g * factor,
    sat_fat_g: per100g.sat_fat_g * factor,
    sodium_mg: per100g.sodium_mg * factor,
  };
}

function expectClose(actual: NutrientTotals, expected: NutrientTotals): void {
  expect(actual.kcal).toBeCloseTo(expected.kcal, 10);
  expect(actual.protein_g).toBeCloseTo(expected.protein_g, 10);
  expect(actual.carbs_g).toBeCloseTo(expected.carbs_g, 10);
  expect(actual.fat_g).toBeCloseTo(expected.fat_g, 10);
  expect(actual.sugar_g).toBeCloseTo(expected.sugar_g, 10);
  expect(actual.fiber_g).toBeCloseTo(expected.fiber_g, 10);
  expect(actual.sat_fat_g).toBeCloseTo(expected.sat_fat_g, 10);
  expect(actual.sodium_mg).toBeCloseTo(expected.sodium_mg, 10);
}

describe("rollupRecipeTotals", () => {
  it("returns all zeros for an empty list", () => {
    expect(rollupRecipeTotals([])).toEqual(zeros());
  });

  it("returns the per-100g values for exactly 100 g", () => {
    const result = rollupRecipeTotals([
      { quantityGrams: 100, nutrientsPer100g: oatsPer100g },
    ]);

    expect(result).toEqual({ ...oatsPer100g });
  });

  it("returns exactly half for 50 g", () => {
    const result = rollupRecipeTotals([
      { quantityGrams: 50, nutrientsPer100g: oatsPer100g },
    ]);

    expectClose(result, scaled(oatsPer100g, 50));
  });

  it("scales a fractional quantity (37.5 g)", () => {
    const result = rollupRecipeTotals([
      { quantityGrams: 37.5, nutrientsPer100g: oatsPer100g },
    ]);

    expectClose(result, scaled(oatsPer100g, 37.5));
    expect(result.kcal).toBeCloseTo(145.875, 10);
  });

  it("treats absent nutrient keys as 0 without producing NaN", () => {
    const result = rollupRecipeTotals([
      { quantityGrams: 200, nutrientsPer100g: { kcal: 100 } },
    ]);

    expect(result.kcal).toBe(200);
    expect(result.protein_g).toBe(0);
    expect(result.sodium_mg).toBe(0);
    expect(Number.isNaN(result.carbs_g)).toBe(false);
  });

  it("guards a NaN nutrient value to 0", () => {
    const result = rollupRecipeTotals([
      { quantityGrams: 100, nutrientsPer100g: { kcal: NaN, protein_g: 50 } },
    ]);

    expect(result.kcal).toBe(0);
    expect(result.protein_g).toBe(50);
  });

  it("contributes 0 for a zero quantity", () => {
    const result = rollupRecipeTotals([
      { quantityGrams: 0, nutrientsPer100g: oatsPer100g },
    ]);

    expect(result).toEqual(zeros());
  });

  it("sums multiple ingredients correctly", () => {
    const chicken: NutrientsPer100g = {
      kcal: 165,
      protein_g: 31,
      carbs_g: 0,
      fat_g: 3.6,
      sugar_g: 0,
      fiber_g: 0,
      sat_fat_g: 1,
      sodium_mg: 74,
    };

    const result = rollupRecipeTotals([
      { quantityGrams: 50, nutrientsPer100g: oatsPer100g },
      { quantityGrams: 150, nutrientsPer100g: chicken },
    ]);

    const a = scaled(oatsPer100g, 50);
    const b = scaled(chicken, 150);
    const expected: NutrientTotals = {
      kcal: a.kcal + b.kcal,
      protein_g: a.protein_g + b.protein_g,
      carbs_g: a.carbs_g + b.carbs_g,
      fat_g: a.fat_g + b.fat_g,
      sugar_g: a.sugar_g + b.sugar_g,
      fiber_g: a.fiber_g + b.fiber_g,
      sat_fat_g: a.sat_fat_g + b.sat_fat_g,
      sodium_mg: a.sodium_mg + b.sodium_mg,
    };

    expectClose(result, expected);
    // protein: 16.9*0.5 + 31*1.5 = 8.45 + 46.5 = 54.95
    expect(result.protein_g).toBeCloseTo(54.95, 10);
  });
});
