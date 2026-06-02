import type { NutrientsPer100g } from "@/lib/nutrition/food-source";

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { rollupRecipeTotals } from "../macro-rollup";
import { recomputeRecipeTotals } from "../recompute-recipe-totals";

import {
  TEST_TENANT_HOST,
  TEST_TRAINER_ID,
  cleanNutritionTestData,
  ensureTestTenant,
  ensureTestTrainer,
} from "@/lib/test/nutrition-test-db";
import { createSupabaseTestClient } from "@/lib/test/supabase-test-client";

const client = createSupabaseTestClient();

const oats: NutrientsPer100g = {
  kcal: 389,
  protein_g: 16.9,
  carbs_g: 66.3,
  fat_g: 6.9,
  sugar_g: 0,
  fiber_g: 10.6,
  sat_fat_g: 1.2,
  sodium_mg: 2,
};

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

describe("recomputeRecipeTotals (integration, local DB)", () => {
  beforeAll(async () => {
    await ensureTestTenant(client);
    await ensureTestTrainer(client);
  });

  afterEach(async () => {
    await cleanNutritionTestData(client);
  });

  afterAll(async () => {
    await cleanNutritionTestData(client);

    const { data } = await client
      .from("recipes")
      .select("id")
      .eq("tenant_host", TEST_TENANT_HOST);

    expect(data ?? []).toHaveLength(0);
  });

  it("recomputes and stores totals from recipe_ingredients", async () => {
    const recipeInsert = await client
      .from("recipes")
      .insert({
        tenant_host: TEST_TENANT_HOST,
        trainer_id: TEST_TRAINER_ID,
        name: "Test Recipe",
      })
      .select("id")
      .single();

    expect(recipeInsert.error).toBeNull();

    const recipeRow = recipeInsert.data as { id: string } | null;

    if (recipeRow === null) {
      throw new Error("recipe insert returned no row");
    }

    const recipeId = recipeRow.id;

    const ingredientsInsert = await client.from("recipe_ingredients").insert([
      {
        recipe_id: recipeId,
        name_snapshot: "Oats",
        quantity: 50,
        unit: "g",
        nutrient_snapshot: oats,
      },
      {
        recipe_id: recipeId,
        name_snapshot: "Chicken",
        quantity: 150,
        unit: "g",
        nutrient_snapshot: chicken,
      },
    ]);

    expect(ingredientsInsert.error).toBeNull();

    const totals = await recomputeRecipeTotals(recipeId, client);

    const expected = rollupRecipeTotals([
      { quantityGrams: 50, nutrientsPer100g: oats },
      { quantityGrams: 150, nutrientsPer100g: chicken },
    ]);

    // Returned totals match the hand-computed sum.
    expect(totals.kcal).toBeCloseTo(expected.kcal, 6);
    expect(totals.protein_g).toBeCloseTo(expected.protein_g, 6);
    expect(totals.sodium_mg).toBeCloseTo(expected.sodium_mg, 6);

    // Stored totals match too.
    const { data: stored, error } = await client
      .from("recipes")
      .select(
        "kcal, protein_g, carbs_g, fat_g, sugar_g, fiber_g, sat_fat_g, sodium_mg"
      )
      .eq("id", recipeId)
      .single();

    expect(error).toBeNull();

    const storedRow = stored as Record<string, unknown> | null;

    if (storedRow === null) {
      throw new Error("recipe row not found after recompute");
    }

    expect(Number(storedRow.kcal)).toBeCloseTo(expected.kcal, 6);
    expect(Number(storedRow.protein_g)).toBeCloseTo(expected.protein_g, 6);
    expect(Number(storedRow.carbs_g)).toBeCloseTo(expected.carbs_g, 6);
    expect(Number(storedRow.sodium_mg)).toBeCloseTo(expected.sodium_mg, 6);
  });
});
