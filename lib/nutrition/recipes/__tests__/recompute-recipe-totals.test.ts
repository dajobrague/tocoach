import type { NutrientTotals } from "../macro-rollup";
import type { SupabaseClient } from "@supabase/supabase-js";

import { describe, expect, it } from "vitest";

import { rollupRecipeTotals } from "../macro-rollup";
import { recomputeRecipeTotals } from "../recompute-recipe-totals";

interface FakeRow {
  quantity: number;
  unit: string;
  nutrient_snapshot: Record<string, number>;
}

/**
 * Build a fake Supabase client: the recipe_ingredients select returns `rows`,
 * and the recipes update captures the totals it was called with.
 */
function makeClient(
  rows: FakeRow[],
  capture: { totals?: NutrientTotals }
): SupabaseClient {
  return {
    from(table: string) {
      if (table === "recipe_ingredients") {
        return {
          select: () => ({
            eq: async () => ({ data: rows, error: null }),
          }),
        };
      }

      return {
        update: (totals: NutrientTotals) => {
          capture.totals = totals;

          return { eq: async () => ({ error: null }) };
        },
      };
    },
  } as unknown as SupabaseClient;
}

const rows: FakeRow[] = [
  {
    quantity: 50,
    unit: "g",
    nutrient_snapshot: {
      kcal: 389,
      protein_g: 16.9,
      carbs_g: 66.3,
      fat_g: 6.9,
      sugar_g: 0,
      fiber_g: 10.6,
      sat_fat_g: 1.2,
      sodium_mg: 2,
    },
  },
  {
    quantity: 150,
    unit: "g",
    nutrient_snapshot: {
      kcal: 165,
      protein_g: 31,
      carbs_g: 0,
      fat_g: 3.6,
      sugar_g: 0,
      fiber_g: 0,
      sat_fat_g: 1,
      sodium_mg: 74,
    },
  },
];

describe("recomputeRecipeTotals", () => {
  it("updates the recipe with totals equal to rollupRecipeTotals of its rows", async () => {
    const capture: { totals?: NutrientTotals } = {};
    const client = makeClient(rows, capture);

    const result = await recomputeRecipeTotals("recipe-1", client);

    const expected = rollupRecipeTotals(
      rows.map((r) => ({
        quantityGrams: r.quantity,
        nutrientsPer100g: r.nutrient_snapshot,
      }))
    );

    expect(result).toEqual(expected);
    expect(capture.totals).toEqual(expected);
  });

  it("writes all-zero totals when the recipe has no ingredients", async () => {
    const capture: { totals?: NutrientTotals } = {};
    const client = makeClient([], capture);

    const result = await recomputeRecipeTotals("recipe-empty", client);

    expect(result).toEqual({
      kcal: 0,
      protein_g: 0,
      carbs_g: 0,
      fat_g: 0,
      sugar_g: 0,
      fiber_g: 0,
      sat_fat_g: 0,
      sodium_mg: 0,
    });
    expect(capture.totals).toEqual(result);
  });

  it("propagates a fetch error", async () => {
    const client = {
      from: () => ({
        select: () => ({
          eq: async () => ({ data: null, error: { message: "boom" } }),
        }),
      }),
    } as unknown as SupabaseClient;

    await expect(recomputeRecipeTotals("recipe-x", client)).rejects.toThrow(
      "fetch failed: boom"
    );
  });
});
