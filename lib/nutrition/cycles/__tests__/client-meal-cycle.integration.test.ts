import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { getActiveCycleTreeForClient } from "../client-cycle-reader";
import { buildClientCycleView } from "../cycle-day";
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

const db = createSupabaseTestClient();
const cycles = new MealCycleService(db);
const options = new MealSlotOptionService(db);
const recipes = new RecipeService(db);
const recipeIngredients = new RecipeIngredientService(db);

let clientA: number;
let clientB: number;

async function seedClient(email: string): Promise<number> {
  const { data, error } = await db
    .from("clients")
    .insert({ name: "P4 Client", email })
    .select("id")
    .single();

  if (error !== null) {
    throw new Error(`seedClient failed: ${error.message}`);
  }

  return (data as { id: number }).id;
}

/** Seed an *active* cycle for `clientId` with one frozen recipe option. */
async function seedActiveCycleWithOption(
  clientId: number,
  startDate: string
): Promise<string> {
  const recipe = await recipes.create(TEST_TENANT_HOST, TEST_TRAINER_ID, {
    name: "Avena con fruta",
  });

  await recipeIngredients.add(TEST_TENANT_HOST, recipe.id, {
    name: "Avena",
    quantity: 100,
    unit: "g",
    nutrientsPer100g: { kcal: 380, protein_g: 13 },
  });

  const cycle = await cycles.create(TEST_TENANT_HOST, {
    trainerId: TEST_TRAINER_ID,
    clientId,
    name: "Ciclo P4",
    durationDays: 3,
    startDate,
  });

  const slot = await cycles.addSlot(TEST_TENANT_HOST, cycle.id, {
    dayIndex: 0,
    label: "Desayuno",
  });

  await options.addRecipeOption(TEST_TENANT_HOST, slot!.id, recipe.id);

  const activated = await cycles.update(TEST_TENANT_HOST, cycle.id, {
    status: "active",
  });

  expect(activated?.status).toBe("active");

  return cycle.id;
}

describe("getActiveCycleTreeForClient (integration, local DB)", () => {
  beforeAll(async () => {
    await ensureTestTenant(db);
    await ensureTestTrainer(db);
    clientA = await seedClient("p4-a@nutrition-v2-test.local");
    clientB = await seedClient("p4-b@nutrition-v2-test.local");
  });

  afterEach(async () => {
    await cleanNutritionTestData(db);
  });

  afterAll(async () => {
    await cleanNutritionTestData(db);
    await db.from("clients").delete().in("id", [clientA, clientB]);
  });

  it("returns the active cycle tree with frozen option snapshots", async () => {
    await seedActiveCycleWithOption(clientA, "2026-06-01");

    const tree = await getActiveCycleTreeForClient(db, clientA);

    expect(tree).not.toBeNull();
    expect(tree?.status).toBe("active");
    expect(tree?.client_id).toBe(clientA);
    expect(tree?.slots).toHaveLength(1);

    const option = tree?.slots[0]?.options[0];

    expect(option?.item_snapshot.sourceType).toBe("recipe");
    expect(option?.item_snapshot.name).toBe("Avena con fruta");
    // Macros come straight from the frozen snapshot — no library join.
    expect(option?.item_snapshot.totals.kcal).toBeGreaterThan(0);
  });

  it("projects today + tree through the client view", async () => {
    await seedActiveCycleWithOption(clientA, "2026-06-01");

    const tree = await getActiveCycleTreeForClient(db, clientA);
    const view = buildClientCycleView(tree, "2026-06-03");

    // 2 days into a 3-day rotation.
    expect(view.position).toEqual({ started: true, dayIndex: 2 });
    expect(view.days).toHaveLength(3);
    expect(view.days[0]?.slots[0]?.label).toBe("Desayuno");
  });

  it("isolates clients — B never sees A's active cycle (§4.4)", async () => {
    await seedActiveCycleWithOption(clientA, "2026-06-01");

    // B has no cycle of their own → clean empty result, never A's data.
    expect(await getActiveCycleTreeForClient(db, clientB)).toBeNull();
  });

  it("ignores draft/archived cycles — only an active one is returned", async () => {
    const draft = await cycles.create(TEST_TENANT_HOST, {
      trainerId: TEST_TRAINER_ID,
      clientId: clientA,
      name: "Borrador",
      durationDays: 3,
    });

    expect(draft.status).toBe("draft");
    expect(await getActiveCycleTreeForClient(db, clientA)).toBeNull();
  });
});
