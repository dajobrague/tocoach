import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import { getActiveCycleTreeForClient } from "../../cycles/client-cycle-reader";
import { MealCycleService } from "../../cycles/meal-cycle-service";
import { MealSlotOptionService } from "../../cycles/meal-slot-option-service";
import {
  getClientSelections,
  setClientSelection,
} from "../../cycles/option-selection";
import { aggregateShoppingList } from "../shopping-list";

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

/**
 * End-to-end shopping-list accuracy against the local DB: seed a real cycle
 * (recipes → frozen snapshots → slots → options → activation → selections),
 * read it back exactly as the route does (getActiveCycleTreeForClient +
 * getClientSelections), then assert the aggregated merged totals for a range.
 */

const db = createSupabaseTestClient();
const cycles = new MealCycleService(db);
const options = new MealSlotOptionService(db);
const recipes = new RecipeService(db);
const recipeIngredients = new RecipeIngredientService(db);

let clientId: number;

/** A recipe with the given (name, quantity, unit) ingredient lines. */
async function seedRecipe(
  name: string,
  lines: Array<{ name: string; quantity: number; unit: string }>
): Promise<string> {
  const recipe = await recipes.create(TEST_TENANT_HOST, TEST_TRAINER_ID, {
    name,
  });

  for (const line of lines) {
    await recipeIngredients.add(TEST_TENANT_HOST, recipe.id, {
      name: line.name,
      quantity: line.quantity,
      unit: line.unit,
    });
  }

  return recipe.id;
}

interface SeededCycle {
  day0SlotId: string;
  avenaOptionId: string;
  polloOptionId: string;
}

/**
 * A 2-day active cycle starting 2026-06-01:
 *   * day 0 slot: option Avena (Oats 50g + Milk 200ml, position 0, the first
 *     option) and option Pollo (Pollo 200g, position 1).
 *   * day 1 slot: option Avena only.
 */
async function seedActiveTwoDayCycle(): Promise<SeededCycle> {
  const avena = await seedRecipe("Avena", [
    { name: "Oats", quantity: 50, unit: "g" },
    { name: "Milk", quantity: 200, unit: "ml" },
  ]);
  const pollo = await seedRecipe("Pollo", [
    { name: "Pollo", quantity: 200, unit: "g" },
  ]);

  const cycle = await cycles.create(TEST_TENANT_HOST, {
    trainerId: TEST_TRAINER_ID,
    clientId,
    name: "Ciclo compras",
    durationDays: 2,
    startDate: "2026-06-01",
  });

  const day0 = await cycles.addSlot(TEST_TENANT_HOST, cycle.id, {
    dayIndex: 0,
    label: "Desayuno",
  });
  const day1 = await cycles.addSlot(TEST_TENANT_HOST, cycle.id, {
    dayIndex: 1,
    label: "Desayuno",
  });

  const avenaOption = await options.addRecipeOption(
    TEST_TENANT_HOST,
    day0!.id,
    avena,
    0
  );
  const polloOption = await options.addRecipeOption(
    TEST_TENANT_HOST,
    day0!.id,
    pollo,
    1
  );

  await options.addRecipeOption(TEST_TENANT_HOST, day1!.id, avena, 0);

  await cycles.update(TEST_TENANT_HOST, cycle.id, { status: "active" });

  return {
    day0SlotId: day0!.id,
    avenaOptionId: avenaOption!.id,
    polloOptionId: polloOption!.id,
  };
}

/** Read back exactly as the route does, then aggregate the range. */
async function shoppingListForRange(from: string, to: string) {
  const [tree, selections] = await Promise.all([
    getActiveCycleTreeForClient(db, clientId),
    getClientSelections(db, clientId),
  ]);

  return aggregateShoppingList({ tree, selections, from, to });
}

describe("shopping-list aggregation (integration, local DB)", () => {
  beforeAll(async () => {
    await ensureTestTenant(db);
    await ensureTestTrainer(db);

    const { data, error } = await db
      .from("clients")
      .insert({
        name: "Shopping List Test Client",
        email: "shopping@nutrition-v2-test.local",
      })
      .select("id")
      .single();

    if (error !== null) {
      throw new Error(`seed client failed: ${error.message}`);
    }

    clientId = (data as { id: number }).id;
  });

  beforeEach(async () => {
    await cleanNutritionTestData(db);
  });

  afterEach(async () => {
    await cleanNutritionTestData(db);
  });

  afterAll(async () => {
    await cleanNutritionTestData(db);
    await db.from("clients").delete().eq("id", clientId);
  });

  it("returns [] when the client has no active cycle", async () => {
    expect(await shoppingListForRange("2026-06-01", "2026-06-07")).toEqual([]);
  });

  it("sums the first option per slot across the range (no selection)", async () => {
    await seedActiveTwoDayCycle();

    // 2026-06-01..06-04 → rotation days [0,1,0,1]. Day 0 first option = Avena,
    // day 1 = Avena → Avena chosen 4×. Oats 50×4=200g, Milk 200×4=800ml.
    const items = await shoppingListForRange("2026-06-01", "2026-06-04");

    expect(items).toEqual([
      { name: "Milk", brand: null, unit: "ml", quantity: 800 },
      { name: "Oats", brand: null, unit: "g", quantity: 200 },
    ]);
  });

  it("honours the client's selection and keeps units separate", async () => {
    const { day0SlotId, polloOptionId } = await seedActiveTwoDayCycle();

    // Select Pollo for the day-0 slot; day-1 slot stays on its only (Avena) option.
    const saved = await setClientSelection(
      db,
      clientId,
      day0SlotId,
      polloOptionId
    );

    expect(saved).not.toBeNull();

    // 06-01..06-04 → days [0,1,0,1]. Day 0 (×2) = Pollo 200g → 400g.
    // Day 1 (×2) = Avena → Oats 100g + Milk 400ml. Units never merge.
    const items = await shoppingListForRange("2026-06-01", "2026-06-04");

    expect(items).toEqual([
      { name: "Milk", brand: null, unit: "ml", quantity: 400 },
      { name: "Oats", brand: null, unit: "g", quantity: 100 },
      { name: "Pollo", brand: null, unit: "g", quantity: 400 },
    ]);
  });

  it("contributes nothing for dates before the cycle start", async () => {
    await seedActiveTwoDayCycle();

    // Whole range precedes start_date 2026-06-01 → empty.
    expect(await shoppingListForRange("2026-05-01", "2026-05-31")).toEqual([]);
  });
});
