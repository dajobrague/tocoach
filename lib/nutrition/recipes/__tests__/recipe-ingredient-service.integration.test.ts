import type { NutrientsPer100g } from "@/lib/nutrition/food-source";

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { rollupRecipeTotals } from "../macro-rollup";
import { RecipeIngredientService } from "../recipe-ingredient-service";
import { RecipeService } from "../recipe-service";

import { createSupabaseTestClient } from "@/lib/test/supabase-test-client";
import {
  TEST_TENANT_HOST,
  TEST_TRAINER_ID,
  cleanNutritionTestData,
  ensureTestTenant,
  ensureTestTrainer,
} from "@/lib/test/nutrition-test-db";

const OTHER_TENANT = "some-other-tenant.invalid";

const client = createSupabaseTestClient();
const recipes = new RecipeService(client);
const ingredients = new RecipeIngredientService(client);

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

async function setFlag(value: boolean): Promise<void> {
  const { error } = await client
    .from("tenants")
    .update({ nutrition_v2_enabled: value })
    .eq("host", TEST_TENANT_HOST);

  if (error !== null) {
    throw new Error(`setFlag failed: ${error.message}`);
  }
}

async function recipeKcal(recipeId: string): Promise<number> {
  const recipe = await recipes.getById(TEST_TENANT_HOST, recipeId);

  return Number(recipe?.kcal);
}

describe("RecipeIngredientService (integration, local DB)", () => {
  beforeAll(async () => {
    await ensureTestTenant(client);
    await ensureTestTrainer(client);
    await setFlag(true);
  });

  afterEach(async () => {
    await cleanNutritionTestData(client);
  });

  afterAll(async () => {
    await cleanNutritionTestData(client);
    await setFlag(false);

    const { data } = await client
      .from("recipes")
      .select("id")
      .eq("tenant_host", TEST_TENANT_HOST);

    expect(data ?? []).toHaveLength(0);
  });

  it("freezes snapshots, recomputes totals, and stays tenant-scoped", async () => {
    // Seed an ingredients cache row to freeze from.
    const cacheInsert = await client
      .from("ingredients")
      .insert({
        tenant_host: TEST_TENANT_HOST,
        source: "manual",
        source_ref: null,
        name: "Cached Oats",
        default_unit: "g",
        ...oats,
      })
      .select("id")
      .single();

    expect(cacheInsert.error).toBeNull();

    const cacheRow = cacheInsert.data as { id: string } | null;

    if (cacheRow === null) {
      throw new Error("ingredient cache insert returned no row");
    }

    const recipe = await recipes.create(TEST_TENANT_HOST, TEST_TRAINER_ID, {
      name: "Test Recipe",
    });
    const recipeId = recipe.id;

    // Add one line frozen from the cache (50 g) and one free-text (150 g).
    const added1 = await ingredients.add(TEST_TENANT_HOST, recipeId, {
      ingredientId: cacheRow.id,
      quantity: 50,
      sortOrder: 0,
    });

    if (added1 === null) {
      throw new Error("add (cache) returned null");
    }

    expect(added1.name_snapshot).toBe("Cached Oats");
    expect(Number(added1.nutrient_snapshot["kcal"])).toBe(389);

    const added2 = await ingredients.add(TEST_TENANT_HOST, recipeId, {
      name: "Chicken",
      quantity: 150,
      sortOrder: 1,
      nutrientsPer100g: chicken,
    });

    if (added2 === null) {
      throw new Error("add (free-text) returned null");
    }

    expect(added2.name_snapshot).toBe("Chicken");

    // Totals = rollup of both lines.
    const expected1 = rollupRecipeTotals([
      { quantityGrams: 50, nutrientsPer100g: oats },
      { quantityGrams: 150, nutrientsPer100g: chicken },
    ]);

    expect(await recipeKcal(recipeId)).toBeCloseTo(expected1.kcal, 6);

    // list returns both, ordered by sort_order.
    const list = await ingredients.list(TEST_TENANT_HOST, recipeId);

    expect(list).not.toBeNull();
    expect(list?.map((r) => r.name_snapshot)).toEqual([
      "Cached Oats",
      "Chicken",
    ]);

    // Update the oats quantity 50 -> 100; totals change.
    const updated = await ingredients.update(
      TEST_TENANT_HOST,
      recipeId,
      added1.id,
      { quantity: 100 }
    );

    expect(updated?.quantity).toBe(100);

    const expected2 = rollupRecipeTotals([
      { quantityGrams: 100, nutrientsPer100g: oats },
      { quantityGrams: 150, nutrientsPer100g: chicken },
    ]);

    expect(await recipeKcal(recipeId)).toBeCloseTo(expected2.kcal, 6);

    // Remove the chicken line; totals change again.
    const removed = await ingredients.remove(
      TEST_TENANT_HOST,
      recipeId,
      added2.id
    );

    expect(removed?.id).toBe(added2.id);

    const expected3 = rollupRecipeTotals([
      { quantityGrams: 100, nutrientsPer100g: oats },
    ]);

    expect(await recipeKcal(recipeId)).toBeCloseTo(expected3.kcal, 6);

    // A second tenant cannot add to / list this recipe.
    const crossAdd = await ingredients.add(OTHER_TENANT, recipeId, {
      name: "Hack",
      quantity: 10,
      nutrientsPer100g: { kcal: 1 },
    });

    expect(crossAdd).toBeNull();
    expect(await ingredients.list(OTHER_TENANT, recipeId)).toBeNull();
  });

  it("appends new lines and keeps order stable across edits, with reorder", async () => {
    const recipe = await recipes.create(TEST_TENANT_HOST, TEST_TRAINER_ID, {
      name: "Order Recipe",
    });
    const recipeId = recipe.id;

    // Add three lines without an explicit sortOrder: the service must append.
    const a = await ingredients.add(TEST_TENANT_HOST, recipeId, {
      name: "A",
      quantity: 100,
      nutrientsPer100g: chicken,
    });
    const b = await ingredients.add(TEST_TENANT_HOST, recipeId, {
      name: "B",
      quantity: 100,
      nutrientsPer100g: chicken,
    });
    const c = await ingredients.add(TEST_TENANT_HOST, recipeId, {
      name: "C",
      quantity: 100,
      nutrientsPer100g: chicken,
    });

    if (a === null || b === null || c === null) {
      throw new Error("add returned null");
    }

    const names = async (): Promise<string[]> => {
      const rows = await ingredients.list(TEST_TENANT_HOST, recipeId);

      return (rows ?? []).map((r) => r.name_snapshot);
    };

    expect(await names()).toEqual(["A", "B", "C"]);

    // Editing a line must NOT reshuffle the list (the reported bug).
    await ingredients.update(TEST_TENANT_HOST, recipeId, a.id, {
      quantity: 250,
    });
    expect(await names()).toEqual(["A", "B", "C"]);

    // Explicit reorder persists the new order.
    const reordered = await ingredients.reorder(TEST_TENANT_HOST, recipeId, [
      c.id,
      a.id,
      b.id,
    ]);

    expect((reordered ?? []).map((r) => r.name_snapshot)).toEqual([
      "C",
      "A",
      "B",
    ]);

    // A second tenant cannot reorder this recipe's lines.
    expect(
      await ingredients.reorder(OTHER_TENANT, recipeId, [a.id, b.id, c.id])
    ).toBeNull();
  });

  it("replaceAll reconciles the whole list (keep+edit, drop, add, reorder)", async () => {
    const recipe = await recipes.create(TEST_TENANT_HOST, TEST_TRAINER_ID, {
      name: "Replace Recipe",
    });
    const recipeId = recipe.id;

    const a = await ingredients.add(TEST_TENANT_HOST, recipeId, {
      name: "A",
      quantity: 100,
      nutrientsPer100g: chicken,
    });
    const b = await ingredients.add(TEST_TENANT_HOST, recipeId, {
      name: "B",
      quantity: 100,
      nutrientsPer100g: chicken,
    });

    if (a === null || b === null) {
      throw new Error("add returned null");
    }

    // Keep A (edit its quantity), drop B, add a new C — and put C first.
    const rows = await ingredients.replaceAll(TEST_TENANT_HOST, recipeId, [
      { name: "C", quantity: 50, nutrientsPer100g: oats },
      { id: a.id, quantity: 250, unit: "g" },
    ]);
    const result = rows ?? [];

    expect(result.map((r) => r.name_snapshot)).toEqual(["C", "A"]);
    // A is updated in place (same id, new quantity), not recreated.
    const keptA = result.find((r) => r.name_snapshot === "A");

    expect(keptA?.id).toBe(a.id);
    expect(Number(keptA?.quantity)).toBe(250);

    // Totals recomputed from the new set (50 g oats + 250 g chicken).
    const expected = rollupRecipeTotals([
      { quantityGrams: 50, nutrientsPer100g: oats },
      { quantityGrams: 250, nutrientsPer100g: chicken },
    ]);

    expect(await recipeKcal(recipeId)).toBeCloseTo(expected.kcal, 6);

    // A second tenant cannot replace this recipe's ingredients.
    expect(await ingredients.replaceAll(OTHER_TENANT, recipeId, [])).toBeNull();
  });

  it("replaceAll persists trainer-corrected macros on an existing line (quantity untouched)", async () => {
    const recipe = await recipes.create(TEST_TENANT_HOST, TEST_TRAINER_ID, {
      name: "Macro Fix Recipe",
    });
    const recipeId = recipe.id;

    const row = await ingredients.add(TEST_TENANT_HOST, recipeId, {
      name: "Pechuga",
      quantity: 200,
      nutrientsPer100g: chicken, // external-API values the trainer distrusts
    });

    if (row === null) throw new Error("add returned null");

    // Correct kcal/protein per 100 g without changing the quantity.
    const corrected = { ...chicken, kcal: 180, protein_g: 25 };
    const rows = await ingredients.replaceAll(TEST_TENANT_HOST, recipeId, [
      { id: row.id, quantity: 200, unit: "g", nutrientsPer100g: corrected },
    ]);
    const kept = (rows ?? []).find((r) => r.id === row.id);

    expect(Number(kept?.quantity)).toBe(200); // unchanged
    expect(kept?.nutrient_snapshot["kcal"]).toBe(180);
    expect(kept?.nutrient_snapshot["protein_g"]).toBe(25);

    // Recipe totals recompute from the corrected values (200 g → ×2).
    expect(await recipeKcal(recipeId)).toBeCloseTo(360, 6);
  });
});
