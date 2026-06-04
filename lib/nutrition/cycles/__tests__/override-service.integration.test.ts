import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { MealCycleService } from "../meal-cycle-service";
import { OverrideService } from "../override-service";

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

const db = createSupabaseTestClient();
const recipes = new RecipeService(db);
const recipeIngredients = new RecipeIngredientService(db);
const cycles = new MealCycleService(db);
const overrides = new OverrideService(db);

let clientId: number;

interface Fixture {
  cycleId: string;
  slotId: string;
  recipeId: string;
}

/** An active cycle with one slot, plus a recipe (the swap source). */
async function seedCycle(): Promise<Fixture> {
  const recipe = await recipes.create(TEST_TENANT_HOST, TEST_TRAINER_ID, {
    name: "Override swap recipe",
  });

  await recipeIngredients.add(TEST_TENANT_HOST, recipe.id, {
    name: "Pollo",
    quantity: 200,
    unit: "g",
    nutrientsPer100g: { kcal: 100 },
  });

  const cycle = await cycles.create(TEST_TENANT_HOST, {
    trainerId: TEST_TRAINER_ID,
    clientId,
    name: "Override cycle",
    durationDays: 3,
    startDate: "2026-06-01",
  });
  const slot = await cycles.addSlot(TEST_TENANT_HOST, cycle.id, {
    dayIndex: 0,
    label: "Desayuno",
  });

  return { cycleId: cycle.id, slotId: slot!.id, recipeId: recipe.id };
}

describe("OverrideService (integration, local DB)", () => {
  beforeAll(async () => {
    await ensureTestTenant(db);
    await ensureTestTrainer(db);

    const { data, error } = await db
      .from("clients")
      .insert({
        name: "Override Test Client",
        email: "override@nutrition-v2-test.local",
      })
      .select("id")
      .single();

    if (error !== null) {
      throw new Error(`seed client failed: ${error.message}`);
    }

    clientId = (data as { id: number }).id;
  });

  afterEach(async () => {
    await cleanNutritionTestData(db);
  });

  afterAll(async () => {
    await cleanNutritionTestData(db);
    await db.from("clients").delete().eq("id", clientId);
  });

  it("creates a note for each scope with the cycle's authoritative client_id", async () => {
    const { cycleId } = await seedCycle();

    const single = await overrides.create(TEST_TENANT_HOST, {
      cycleId,
      overrideType: "note",
      scope: "single_day",
      anchorDate: "2026-06-03",
      noteText: "single",
    });
    const forward = await overrides.create(TEST_TENANT_HOST, {
      cycleId,
      overrideType: "note",
      scope: "day_forward",
      anchorDate: "2026-06-02",
      noteText: "forward",
    });
    const every = await overrides.create(TEST_TENANT_HOST, {
      cycleId,
      overrideType: "note",
      scope: "every_cycle",
      anchorDate: "2026-06-01",
      dayIndex: 0,
      noteText: "every",
    });

    expect(single?.scope).toBe("single_day");
    expect(forward?.scope).toBe("day_forward");
    expect(every?.day_index).toBe(0);
    // client_id is taken from the cycle, never the request.
    expect(single?.client_id).toBe(clientId);
    expect(every?.swap_snapshot).toBeNull();
  });

  it("creates a swap that freezes swap_snapshot from the recipe", async () => {
    const { cycleId, slotId, recipeId } = await seedCycle();

    const swap = await overrides.create(TEST_TENANT_HOST, {
      cycleId,
      overrideType: "swap",
      scope: "single_day",
      anchorDate: "2026-06-03",
      slotId,
      swapSourceType: "recipe",
      swapSourceRefId: recipeId,
    });

    expect(swap?.override_type).toBe("swap");
    expect(swap?.slot_id).toBe(slotId);
    // 200 g of a 100 kcal/100 g ingredient → 200 kcal frozen into the snapshot.
    expect(swap?.swap_snapshot?.totals.kcal).toBe(200);
    expect(swap?.swap_snapshot?.name).toBe("Override swap recipe");
  });

  it("keeps the swap_snapshot frozen after the source recipe is edited (§4.1)", async () => {
    const { cycleId, slotId, recipeId } = await seedCycle();

    const swap = await overrides.create(TEST_TENANT_HOST, {
      cycleId,
      overrideType: "swap",
      scope: "single_day",
      anchorDate: "2026-06-03",
      slotId,
      swapSourceType: "recipe",
      swapSourceRefId: recipeId,
    });

    // Edit the library recipe AFTER the swap froze.
    await db
      .from("recipes")
      .update({ name: "RENAMED", kcal: 999 })
      .eq("id", recipeId);

    const reread = await overrides.getById(TEST_TENANT_HOST, swap!.id);

    // The frozen snapshot is unchanged — no live read of the mutated recipe.
    expect(reread?.swap_snapshot?.name).toBe("Override swap recipe");
    expect(reread?.swap_snapshot?.totals.kcal).toBe(200);
  });

  it("rejects creating on a cycle outside the tenant (cross-tenant) with no write", async () => {
    const { cycleId } = await seedCycle();

    // Same cycle id, but scoped to a different tenant → not found → null.
    const result = await overrides.create(OTHER_TENANT, {
      cycleId,
      overrideType: "note",
      scope: "single_day",
      anchorDate: "2026-06-03",
      noteText: "should not persist",
    });

    expect(result).toBeNull();

    const list = await overrides.listForCycle(TEST_TENANT_HOST, cycleId);

    expect(list).toHaveLength(0);
  });

  it("rejects a swap whose slot is not in the cycle (no write)", async () => {
    const { cycleId, recipeId } = await seedCycle();
    const other = await seedCycle(); // a slot belonging to a different cycle

    const result = await overrides.create(TEST_TENANT_HOST, {
      cycleId,
      overrideType: "swap",
      scope: "single_day",
      anchorDate: "2026-06-03",
      slotId: other.slotId,
      swapSourceType: "recipe",
      swapSourceRefId: recipeId,
    });

    expect(result).toBeNull();
  });

  it("rejects a swap whose source recipe isn't found (no write)", async () => {
    const { cycleId, slotId } = await seedCycle();

    const result = await overrides.create(TEST_TENANT_HOST, {
      cycleId,
      overrideType: "swap",
      scope: "single_day",
      anchorDate: "2026-06-03",
      slotId,
      swapSourceType: "recipe",
      swapSourceRefId: "00000000-0000-4000-a000-000000000999",
    });

    expect(result).toBeNull();
  });

  it("deletes an override (tenant-scoped)", async () => {
    const { cycleId } = await seedCycle();
    const note = await overrides.create(TEST_TENANT_HOST, {
      cycleId,
      overrideType: "note",
      scope: "single_day",
      anchorDate: "2026-06-03",
      noteText: "to delete",
    });

    expect(await overrides.delete(TEST_TENANT_HOST, note!.id)).not.toBeNull();
    expect(
      await overrides.listForCycle(TEST_TENANT_HOST, cycleId)
    ).toHaveLength(0);
  });
});
