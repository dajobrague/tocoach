import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  ActiveCycleConflictError,
  MealCycleService,
  MealCycleValidationError,
} from "../meal-cycle-service";
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
const cycles = new MealCycleService(client);
const options = new MealSlotOptionService(client);
const recipes = new RecipeService(client);
const recipeIngredients = new RecipeIngredientService(client);

let clientA: number;
let clientB: number;

async function seedClient(email: string): Promise<number> {
  const { data, error } = await client
    .from("clients")
    .insert({ name: "Cycle API Test Client", email })
    .select("id")
    .single();

  if (error !== null) {
    throw new Error(`seedClient failed: ${error.message}`);
  }

  return (data as { id: number }).id;
}

async function draftFor(clientId: number): Promise<string> {
  const cycle = await cycles.create(TEST_TENANT_HOST, {
    trainerId: TEST_TRAINER_ID,
    clientId,
    name: "Ciclo",
    durationDays: 3,
  });

  return cycle.id;
}

describe("MealCycleService API methods (integration, local DB)", () => {
  beforeAll(async () => {
    await ensureTestTenant(client);
    await ensureTestTrainer(client);
    clientA = await seedClient("cycle-a@nutrition-v2-test.local");
    clientB = await seedClient("cycle-b@nutrition-v2-test.local");
  });

  afterEach(async () => {
    await cleanNutritionTestData(client);
  });

  afterAll(async () => {
    await cleanNutritionTestData(client);
    await client.from("clients").delete().in("id", [clientA, clientB]);

    const { data } = await client
      .from("meal_cycles")
      .select("id")
      .eq("tenant_host", TEST_TENANT_HOST);

    expect(data ?? []).toHaveLength(0);
  });

  it("lists cycles filtered by client", async () => {
    await draftFor(clientA);
    await draftFor(clientA);
    await draftFor(clientB);

    expect(
      await cycles.list(TEST_TENANT_HOST, { clientId: clientA })
    ).toHaveLength(2);
    expect(
      await cycles.list(TEST_TENANT_HOST, { clientId: clientB })
    ).toHaveLength(1);
    expect(await cycles.list(TEST_TENANT_HOST)).toHaveLength(3);
  });

  it("returns the slots + options tree (ordered)", async () => {
    const recipe = await recipes.create(TEST_TENANT_HOST, TEST_TRAINER_ID, {
      name: "Avena",
    });

    await recipeIngredients.add(TEST_TENANT_HOST, recipe.id, {
      name: "Avena",
      quantity: 100,
      unit: "g",
      nutrientsPer100g: { kcal: 100 },
    });

    const cycleId = await draftFor(clientA);
    const slot1 = await cycles.addSlot(TEST_TENANT_HOST, cycleId, {
      dayIndex: 0,
      label: "Desayuno",
    });

    await cycles.addSlot(TEST_TENANT_HOST, cycleId, {
      dayIndex: 1,
      label: "Comida",
    });
    await options.addRecipeOption(TEST_TENANT_HOST, slot1!.id, recipe.id);

    const tree = await cycles.getByIdWithTree(TEST_TENANT_HOST, cycleId);

    expect(tree?.slots).toHaveLength(2);
    expect(tree?.slots[0]?.label).toBe("Desayuno");
    expect(tree?.slots[0]?.options).toHaveLength(1);
    expect(tree?.slots[0]?.options[0]?.item_snapshot.sourceType).toBe("recipe");
    expect(tree?.slots[1]?.options).toHaveLength(0);
  });

  it("enforces one active cycle per client (app layer → 409)", async () => {
    const first = await draftFor(clientA);
    const second = await draftFor(clientA);

    const activated = await cycles.update(TEST_TENANT_HOST, first, {
      status: "active",
    });

    expect(activated?.status).toBe("active");

    // Second activation for the same client is refused.
    await expect(
      cycles.update(TEST_TENANT_HOST, second, { status: "active" })
    ).rejects.toBeInstanceOf(ActiveCycleConflictError);

    // A different client can still be activated.
    const otherClientCycle = await draftFor(clientB);

    expect(
      (
        await cycles.update(TEST_TENANT_HOST, otherClientCycle, {
          status: "active",
        })
      )?.status
    ).toBe("active");
  });

  it("the DB partial-unique index is the backstop for a second activation", async () => {
    const first = await draftFor(clientA);
    const second = await draftFor(clientA);

    // Bypass the service's app-layer check with raw updates.
    const ok = await client
      .from("meal_cycles")
      .update({ status: "active" })
      .eq("id", first);

    expect(ok.error).toBeNull();

    const conflict = await client
      .from("meal_cycles")
      .update({ status: "active" })
      .eq("id", second);

    expect(conflict.error).not.toBeNull();
    expect(conflict.error?.code).toBe("23505");
  });

  it("archives via status update rather than deleting", async () => {
    const cycleId = await draftFor(clientA);
    const archived = await cycles.update(TEST_TENANT_HOST, cycleId, {
      status: "archived",
    });

    expect(archived?.status).toBe("archived");
    expect(await cycles.getById(TEST_TENANT_HOST, cycleId)).not.toBeNull();
  });

  it("rejects an out-of-range day_index with no row written", async () => {
    const cycleId = await draftFor(clientA); // duration 3 → valid 0..2

    await expect(
      cycles.addSlot(TEST_TENANT_HOST, cycleId, { dayIndex: 3 })
    ).rejects.toBeInstanceOf(MealCycleValidationError);

    const tree = await cycles.getByIdWithTree(TEST_TENANT_HOST, cycleId);

    expect(tree?.slots).toHaveLength(0);
  });

  it("range-checks day_index on slot update too", async () => {
    const cycleId = await draftFor(clientA);
    const slot = await cycles.addSlot(TEST_TENANT_HOST, cycleId, {
      dayIndex: 0,
    });

    await expect(
      cycles.updateSlot(TEST_TENANT_HOST, slot!.id, { dayIndex: 9 })
    ).rejects.toBeInstanceOf(MealCycleValidationError);
  });

  it("is tenant-scoped — another tenant cannot read or mutate the cycle/slot", async () => {
    const cycleId = await draftFor(clientA);
    const slot = await cycles.addSlot(TEST_TENANT_HOST, cycleId, {
      dayIndex: 0,
    });

    expect(await cycles.getById(OTHER_TENANT, cycleId)).toBeNull();
    expect(await cycles.getByIdWithTree(OTHER_TENANT, cycleId)).toBeNull();
    expect(
      await cycles.update(OTHER_TENANT, cycleId, { status: "archived" })
    ).toBeNull();
    expect(
      await cycles.addSlot(OTHER_TENANT, cycleId, { dayIndex: 0 })
    ).toBeNull();
    expect(
      await cycles.updateSlot(OTHER_TENANT, slot!.id, { position: 5 })
    ).toBeNull();
    expect(await cycles.deleteSlot(OTHER_TENANT, slot!.id)).toBeNull();

    // The cycle is untouched: still draft, still has its slot.
    const tree = await cycles.getByIdWithTree(TEST_TENANT_HOST, cycleId);

    expect(tree?.status).toBe("draft");
    expect(tree?.slots).toHaveLength(1);
  });

  it("reorders and deletes options tenant-scoped", async () => {
    const recipe = await recipes.create(TEST_TENANT_HOST, TEST_TRAINER_ID, {
      name: "R",
    });

    await recipeIngredients.add(TEST_TENANT_HOST, recipe.id, {
      name: "X",
      quantity: 100,
      unit: "g",
      nutrientsPer100g: { kcal: 1 },
    });

    const cycleId = await draftFor(clientA);
    const slot = await cycles.addSlot(TEST_TENANT_HOST, cycleId, {
      dayIndex: 0,
    });
    const option = await options.addRecipeOption(
      TEST_TENANT_HOST,
      slot!.id,
      recipe.id
    );

    // Cross-tenant cannot reorder or delete.
    expect(
      await options.updateOption(OTHER_TENANT, option!.id, { position: 3 })
    ).toBeNull();
    expect(await options.deleteOption(OTHER_TENANT, option!.id)).toBeNull();

    // Owner can.
    expect(
      (
        await options.updateOption(TEST_TENANT_HOST, option!.id, {
          position: 3,
        })
      )?.position
    ).toBe(3);
    expect(
      await options.deleteOption(TEST_TENANT_HOST, option!.id)
    ).not.toBeNull();
    expect(await options.listForSlot(TEST_TENANT_HOST, slot!.id)).toHaveLength(
      0
    );
  });
});
