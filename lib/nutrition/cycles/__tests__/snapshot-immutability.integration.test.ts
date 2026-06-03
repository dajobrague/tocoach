import type { OptionSnapshot } from "../option-snapshot";

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { MealCycleService } from "../meal-cycle-service";
import { MealSlotOptionService } from "../meal-slot-option-service";

import { RecipeIngredientService } from "@/lib/nutrition/recipes/recipe-ingredient-service";
import { RecipeService } from "@/lib/nutrition/recipes/recipe-service";
import {
  TEST_TENANT_HOST,
  TEST_TRAINER_ID,
  cleanNutritionTestData,
  ensureTestTenant,
  ensureTestTrainer,
} from "@/lib/test/nutrition-test-db";
import { createSupabaseTestClient } from "@/lib/test/supabase-test-client";

const OTHER_TENANT = "some-other-tenant.invalid";

const client = createSupabaseTestClient();
const recipes = new RecipeService(client);
const recipeIngredients = new RecipeIngredientService(client);
const cycles = new MealCycleService(client);
const options = new MealSlotOptionService(client);

let clientId: number;

async function readSnapshot(optionId: string): Promise<OptionSnapshot> {
  const { data, error } = await client
    .from("meal_slot_options")
    .select("item_snapshot")
    .eq("id", optionId)
    .single();

  if (error !== null) {
    throw new Error(`readSnapshot failed: ${error.message}`);
  }

  return (data as { item_snapshot: OptionSnapshot }).item_snapshot;
}

async function seedIngredient(name: string, kcal: number): Promise<string> {
  const { data, error } = await client
    .from("ingredients")
    .insert({
      tenant_host: TEST_TENANT_HOST,
      source: "manual",
      name,
      kcal,
      protein_g: 1.1,
      carbs_g: 23,
    })
    .select("id")
    .single();

  if (error !== null) {
    throw new Error(`seedIngredient failed: ${error.message}`);
  }

  return (data as { id: string }).id;
}

async function newCycleSlot(): Promise<string> {
  const cycle = await cycles.create(TEST_TENANT_HOST, {
    trainerId: TEST_TRAINER_ID,
    clientId,
    name: "Ciclo de prueba",
    durationDays: 3,
  });
  const slot = await cycles.addSlot(TEST_TENANT_HOST, cycle.id, {
    dayIndex: 0,
    label: "Desayuno",
  });

  if (slot === null) {
    throw new Error("newCycleSlot: slot was not created");
  }

  return slot.id;
}

describe("MealSlotOptionService snapshot immutability (§4.1, local DB)", () => {
  beforeAll(async () => {
    await ensureTestTenant(client);
    await ensureTestTrainer(client);

    const { data, error } = await client
      .from("clients")
      .insert({
        name: "Snapshot Test Client",
        email: "client@nutrition-v2-test.local",
      })
      .select("id")
      .single();

    if (error !== null) {
      throw new Error(`seed client failed: ${error.message}`);
    }

    clientId = (data as { id: number }).id;
  });

  afterEach(async () => {
    await cleanNutritionTestData(client);
  });

  afterAll(async () => {
    await cleanNutritionTestData(client);
    await client.from("clients").delete().eq("id", clientId);

    const { data } = await client
      .from("meal_cycles")
      .select("id")
      .eq("tenant_host", TEST_TENANT_HOST);

    expect(data ?? []).toHaveLength(0);
  });

  it("freezes a recipe option that a later library edit cannot mutate", async () => {
    // 1. A recipe with one macro-bearing ingredient.
    const recipe = await recipes.create(TEST_TENANT_HOST, TEST_TRAINER_ID, {
      name: "Avena con leche",
      status: "active",
    });
    const line = await recipeIngredients.add(TEST_TENANT_HOST, recipe.id, {
      name: "Avena",
      quantity: 200,
      unit: "g",
      nutrientsPer100g: { kcal: 100, protein_g: 10 },
    });

    expect(line).not.toBeNull();

    // 2. A cycle + slot, then add the recipe as an option (snapshot frozen).
    const slotId = await newCycleSlot();
    const option = await options.addRecipeOption(
      TEST_TENANT_HOST,
      slotId,
      recipe.id
    );

    expect(option).not.toBeNull();

    const frozen = await readSnapshot(option!.id);

    expect(frozen.sourceType).toBe("recipe");
    expect(frozen.sourceRefId).toBe(recipe.id);
    expect(frozen.ingredients).toEqual([
      {
        name: "Avena",
        quantity: 200,
        unit: "g",
        nutrientsPer100g: { kcal: 100, protein_g: 10 },
      },
    ]);
    expect(frozen.totals.kcal).toBeCloseTo(200, 4); // 200g * 100/100
    expect(frozen.totals.protein_g).toBeCloseTo(20, 4);

    // 3. EDIT the recipe in the library — change quantity AND macros.
    const edited = await recipeIngredients.update(
      TEST_TENANT_HOST,
      recipe.id,
      line!.id,
      { quantity: 50, nutrientsPer100g: { kcal: 999, protein_g: 1 } }
    );

    expect(edited).not.toBeNull();

    // 4. The stored snapshot is byte-for-byte unchanged.
    const reread = await readSnapshot(option!.id);

    expect(reread).toEqual(frozen);
    expect(JSON.stringify(reread)).toBe(JSON.stringify(frozen));

    // 5. A NEW option from the same recipe reflects the edit.
    const option2 = await options.addRecipeOption(
      TEST_TENANT_HOST,
      slotId,
      recipe.id,
      1
    );
    const snap2 = await readSnapshot(option2!.id);

    expect(snap2.ingredients).toEqual([
      {
        name: "Avena",
        quantity: 50,
        unit: "g",
        nutrientsPer100g: { kcal: 999, protein_g: 1 },
      },
    ]);
    expect(snap2.totals.kcal).toBeCloseTo(499.5, 4); // 50g * 999/100
    expect(snap2).not.toEqual(frozen);
  });

  it("freezes a food option independent of the ingredients cache", async () => {
    const ingredientId = await seedIngredient("Plátano", 89);
    const slotId = await newCycleSlot();

    const option = await options.addFoodOption(
      TEST_TENANT_HOST,
      slotId,
      ingredientId,
      120
    );

    expect(option).not.toBeNull();

    const frozen = await readSnapshot(option!.id);

    expect(frozen.sourceType).toBe("food");
    expect(frozen.name).toBe("Plátano");
    expect(frozen.steps).toBeNull();
    expect(frozen.images).toEqual([]);
    // The ingredients cache stores all 8 macro columns (0 when unset), so the
    // frozen snapshot carries the full per-100g set.
    expect(frozen.ingredients).toEqual([
      {
        name: "Plátano",
        quantity: 120,
        unit: "g",
        nutrientsPer100g: {
          kcal: 89,
          protein_g: 1.1,
          carbs_g: 23,
          fat_g: 0,
          sugar_g: 0,
          fiber_g: 0,
          sat_fat_g: 0,
          sodium_mg: 0,
        },
      },
    ]);
    expect(frozen.totals.kcal).toBeCloseTo(106.8, 4);

    // Editing the cached ingredient does not touch the frozen option.
    await client.from("ingredients").update({ kcal: 1 }).eq("id", ingredientId);

    expect(await readSnapshot(option!.id)).toEqual(frozen);
  });

  it("is tenant-scoped — another tenant cannot add an option to this slot", async () => {
    const recipe = await recipes.create(TEST_TENANT_HOST, TEST_TRAINER_ID, {
      name: "Receta privada",
    });

    await recipeIngredients.add(TEST_TENANT_HOST, recipe.id, {
      name: "Algo",
      quantity: 100,
      unit: "g",
      nutrientsPer100g: { kcal: 50 },
    });

    const slotId = await newCycleSlot();

    // Another tenant cannot attach to this tenant's slot.
    expect(
      await options.addRecipeOption(OTHER_TENANT, slotId, recipe.id)
    ).toBeNull();
    expect(
      await options.addFoodOption(OTHER_TENANT, slotId, recipe.id, 100)
    ).toBeNull();

    // And nothing was written to the slot.
    const list = await options.listForSlot(TEST_TENANT_HOST, slotId);

    expect(list).toEqual([]);
  });
});
