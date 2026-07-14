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

  it("copyDay replaces the target day with a verbatim copy of the source day", async () => {
    const recipe = await recipes.create(TEST_TENANT_HOST, TEST_TRAINER_ID, {
      name: "Avena",
      status: "active",
    });

    await recipeIngredients.add(TEST_TENANT_HOST, recipe.id, {
      name: "Avena",
      quantity: 100,
      unit: "g",
      nutrientsPer100g: { kcal: 100, protein_g: 5 },
    });

    const { data: ing } = await client
      .from("ingredients")
      .insert({
        tenant_host: TEST_TENANT_HOST,
        source: "manual",
        name: "Plátano",
        kcal: 89,
      })
      .select("id")
      .single();
    const ingredientId = (ing as { id: string }).id;

    const cycleId = await draftFor(clientA);
    // Source day 0: two meals (a recipe and a food).
    const s1 = await cycles.addSlot(TEST_TENANT_HOST, cycleId, {
      dayIndex: 0,
      label: "Desayuno",
      position: 0,
    });
    const s2 = await cycles.addSlot(TEST_TENANT_HOST, cycleId, {
      dayIndex: 0,
      label: "Comida",
      position: 1,
    });

    await options.addRecipeOption(TEST_TENANT_HOST, s1!.id, recipe.id);
    await options.addFoodOption(TEST_TENANT_HOST, s2!.id, ingredientId, 120);

    // Target day 1 already has a meal that must be replaced.
    const stale = await cycles.addSlot(TEST_TENANT_HOST, cycleId, {
      dayIndex: 1,
      label: "Viejo",
      position: 0,
    });

    await options.addRecipeOption(TEST_TENANT_HOST, stale!.id, recipe.id);

    expect(await cycles.copyDay(TEST_TENANT_HOST, cycleId, 0, 1)).toBe(true);

    const tree = await cycles.getByIdWithTree(TEST_TENANT_HOST, cycleId);
    const day1 = (tree?.slots ?? [])
      .filter((slot) => slot.day_index === 1)
      .sort((a, b) => a.position - b.position);

    // Target day now mirrors the source (the "Viejo" slot is gone).
    expect(day1.map((slot) => slot.label)).toEqual(["Desayuno", "Comida"]);
    expect(day1[0]?.options[0]?.source_ref_id).toBe(recipe.id);
    expect(day1[0]?.options[0]?.item_snapshot.name).toBe("Avena");
    expect(day1[1]?.options[0]?.source_type).toBe("food");
    expect(day1[1]?.options[0]?.item_snapshot.name).toBe("Plátano");

    // Source day untouched.
    const day0 = (tree?.slots ?? []).filter((slot) => slot.day_index === 0);

    expect(day0.map((slot) => slot.label)).toEqual(["Desayuno", "Comida"]);
  });

  it("copyDay rejects equal source/target and out-of-range days", async () => {
    const cycleId = await draftFor(clientA); // duration 3 → valid 0..2

    await expect(
      cycles.copyDay(TEST_TENANT_HOST, cycleId, 1, 1)
    ).rejects.toBeInstanceOf(MealCycleValidationError);
    await expect(
      cycles.copyDay(TEST_TENANT_HOST, cycleId, 0, 5)
    ).rejects.toBeInstanceOf(MealCycleValidationError);
  });

  it("copyDay returns null for a cycle that isn't the tenant's", async () => {
    const cycleId = await draftFor(clientA);

    expect(await cycles.copyDay(OTHER_TENANT, cycleId, 0, 1)).toBeNull();
  });

  it("removeDay deletes the day's slots and renumbers the later days down", async () => {
    const recipe = await recipes.create(TEST_TENANT_HOST, TEST_TRAINER_ID, {
      name: "Avena",
      status: "active",
    });

    await recipeIngredients.add(TEST_TENANT_HOST, recipe.id, {
      name: "Avena",
      quantity: 100,
      unit: "g",
      nutrientsPer100g: { kcal: 100 },
    });

    const cycleId = await draftFor(clientA); // duration 3 → days 0,1,2

    await cycles.addSlot(TEST_TENANT_HOST, cycleId, {
      dayIndex: 0,
      label: "D0",
      position: 0,
    });
    const mid = await cycles.addSlot(TEST_TENANT_HOST, cycleId, {
      dayIndex: 1,
      label: "D1",
      position: 0,
    });
    const last = await cycles.addSlot(TEST_TENANT_HOST, cycleId, {
      dayIndex: 2,
      label: "D2",
      position: 0,
    });

    await options.addRecipeOption(TEST_TENANT_HOST, mid!.id, recipe.id);
    await options.addRecipeOption(TEST_TENANT_HOST, last!.id, recipe.id);

    expect(await cycles.removeDay(TEST_TENANT_HOST, cycleId, 1)).toBe(true);

    const tree = await cycles.getByIdWithTree(TEST_TENANT_HOST, cycleId);

    // Duration shrank and the removed day's slot is gone.
    expect(tree?.duration_days).toBe(2);
    expect((tree?.slots ?? []).some((slot) => slot.id === mid!.id)).toBe(false);

    // Day 2's slot renumbered to day 1, options preserved.
    const shifted = (tree?.slots ?? []).find((slot) => slot.id === last!.id);

    expect(shifted?.day_index).toBe(1);
    expect(shifted?.label).toBe("D2");

    const day1 = (tree?.slots ?? []).filter((slot) => slot.day_index === 1);

    expect(day1).toHaveLength(1);
    expect(day1[0]?.options).toHaveLength(1);

    // Day 0 untouched.
    expect(
      (tree?.slots ?? [])
        .filter((slot) => slot.day_index === 0)
        .map((s) => s.label)
    ).toEqual(["D0"]);
  });

  it("removeDay refuses to remove the last remaining day", async () => {
    const cycle = await cycles.create(TEST_TENANT_HOST, {
      trainerId: TEST_TRAINER_ID,
      clientId: clientA,
      name: "Un día",
      durationDays: 1,
    });

    await expect(
      cycles.removeDay(TEST_TENANT_HOST, cycle.id, 0)
    ).rejects.toBeInstanceOf(MealCycleValidationError);
  });

  it("removeDay range-checks the day index and is tenant-scoped", async () => {
    const cycleId = await draftFor(clientA); // duration 3 → valid 0..2

    await expect(
      cycles.removeDay(TEST_TENANT_HOST, cycleId, 5)
    ).rejects.toBeInstanceOf(MealCycleValidationError);
    expect(await cycles.removeDay(OTHER_TENANT, cycleId, 0)).toBeNull();
  });

  it("addDay appends a blank day, growing duration with no new slots", async () => {
    const cycleId = await draftFor(clientA); // duration 3

    await cycles.addSlot(TEST_TENANT_HOST, cycleId, {
      dayIndex: 0,
      label: "D0",
    });

    expect(await cycles.addDay(TEST_TENANT_HOST, cycleId)).toBe(true);

    const tree = await cycles.getByIdWithTree(TEST_TENANT_HOST, cycleId);

    expect(tree?.duration_days).toBe(4);
    expect(tree?.slots).toHaveLength(1); // no slots added for the new day
    expect((tree?.slots ?? []).filter((s) => s.day_index === 3)).toHaveLength(
      0
    );
  });

  it("addDay can seed the new day from a copy of an existing day", async () => {
    const recipe = await recipes.create(TEST_TENANT_HOST, TEST_TRAINER_ID, {
      name: "Avena",
      status: "active",
    });

    await recipeIngredients.add(TEST_TENANT_HOST, recipe.id, {
      name: "Avena",
      quantity: 100,
      unit: "g",
      nutrientsPer100g: { kcal: 100 },
    });

    const cycleId = await draftFor(clientA); // duration 3 → new day is index 3
    const s1 = await cycles.addSlot(TEST_TENANT_HOST, cycleId, {
      dayIndex: 0,
      label: "Desayuno",
      position: 0,
    });

    await options.addRecipeOption(TEST_TENANT_HOST, s1!.id, recipe.id);

    expect(await cycles.addDay(TEST_TENANT_HOST, cycleId, 0)).toBe(true);

    const tree = await cycles.getByIdWithTree(TEST_TENANT_HOST, cycleId);

    expect(tree?.duration_days).toBe(4);

    const newDay = (tree?.slots ?? []).filter((slot) => slot.day_index === 3);

    expect(newDay.map((slot) => slot.label)).toEqual(["Desayuno"]);
    expect(newDay[0]?.options[0]?.item_snapshot.name).toBe("Avena");
  });

  it("addDay returns null for a cycle that isn't the tenant's", async () => {
    const cycleId = await draftFor(clientA);

    expect(await cycles.addDay(OTHER_TENANT, cycleId)).toBeNull();
  });

  it("reorderDay moves a day and renumbers the ones in between", async () => {
    const cycle = await cycles.create(TEST_TENANT_HOST, {
      trainerId: TEST_TRAINER_ID,
      clientId: clientA,
      name: "Reorder",
      durationDays: 5, // days 0..4
    });

    // One labelled slot per day so we can track where each day lands.
    for (let d = 0; d < 5; d += 1) {
      await cycles.addSlot(TEST_TENANT_HOST, cycle.id, {
        dayIndex: d,
        label: `S${d}`,
        position: 0,
      });
    }

    // Move day 4 to position 1: expected new order of old days = [0,4,1,2,3].
    expect(await cycles.reorderDay(TEST_TENANT_HOST, cycle.id, 4, 1)).toBe(
      true
    );

    const tree = await cycles.getByIdWithTree(TEST_TENANT_HOST, cycle.id);
    const labelByDay = new Map(
      (tree?.slots ?? []).map((slot) => [slot.day_index, slot.label])
    );

    expect(labelByDay.get(0)).toBe("S0");
    expect(labelByDay.get(1)).toBe("S4");
    expect(labelByDay.get(2)).toBe("S1");
    expect(labelByDay.get(3)).toBe("S2");
    expect(labelByDay.get(4)).toBe("S3");
    expect(tree?.duration_days).toBe(5); // duration unchanged
  });

  it("reorderDay range-checks indices and is tenant-scoped; equal is a no-op", async () => {
    const cycleId = await draftFor(clientA); // duration 3 → valid 0..2

    await expect(
      cycles.reorderDay(TEST_TENANT_HOST, cycleId, 0, 9)
    ).rejects.toBeInstanceOf(MealCycleValidationError);
    expect(await cycles.reorderDay(TEST_TENANT_HOST, cycleId, 1, 1)).toBe(true);
    expect(await cycles.reorderDay(OTHER_TENANT, cycleId, 0, 1)).toBeNull();
  });

  it("overlays a recipe option's photo with the live library media, keeping nutrition frozen", async () => {
    const recipe = await recipes.create(TEST_TENANT_HOST, TEST_TRAINER_ID, {
      name: "Tostadas",
      status: "active",
    });

    await recipeIngredients.add(TEST_TENANT_HOST, recipe.id, {
      name: "Pan",
      quantity: 100,
      unit: "g",
      nutrientsPer100g: { kcal: 250, protein_g: 9 },
    });

    // Initial library image, then freeze the option from it.
    await client.from("recipe_media").insert({
      recipe_id: recipe.id,
      type: "image",
      url: "https://cdn/old.jpg",
      orientation: "horizontal",
      sort_order: 0,
    });

    const cycleId = await draftFor(clientA);
    const slot = await cycles.addSlot(TEST_TENANT_HOST, cycleId, {
      dayIndex: 0,
      label: "Desayuno",
      position: 0,
    });

    await options.addRecipeOption(TEST_TENANT_HOST, slot!.id, recipe.id);

    // The freeze captured the old image.
    const before = await cycles.getByIdWithTree(TEST_TENANT_HOST, cycleId);
    const frozen = before?.slots[0]?.options[0]?.item_snapshot;

    expect(frozen?.images[0]?.url).toBe("https://cdn/old.jpg");

    // Trainer edits the recipe image in the library (old row+object replaced).
    await client.from("recipe_media").delete().eq("recipe_id", recipe.id);
    await client.from("recipe_media").insert({
      recipe_id: recipe.id,
      type: "image",
      url: "https://cdn/new.jpg",
      orientation: "vertical",
      sort_order: 0,
    });

    // Reading the tree now shows the NEW image; frozen nutrition is intact.
    const after = await cycles.getByIdWithTree(TEST_TENANT_HOST, cycleId);
    const option = after?.slots[0]?.options[0]?.item_snapshot;

    expect(option?.media).toEqual([
      { type: "image", url: "https://cdn/new.jpg", orientation: "vertical" },
    ]);
    expect(option?.images).toEqual([
      { url: "https://cdn/new.jpg", orientation: "vertical" },
    ]);
    expect(option?.totals).toEqual(frozen?.totals);
    expect(option?.ingredients).toEqual(frozen?.ingredients);
  });

  it("falls back to the frozen photo when the recipe has no live media", async () => {
    const recipe = await recipes.create(TEST_TENANT_HOST, TEST_TRAINER_ID, {
      name: "Sopa",
      status: "active",
    });

    await client.from("recipe_media").insert({
      recipe_id: recipe.id,
      type: "image",
      url: "https://cdn/frozen.jpg",
      orientation: "horizontal",
      sort_order: 0,
    });

    const cycleId = await draftFor(clientA);
    const slot = await cycles.addSlot(TEST_TENANT_HOST, cycleId, {
      dayIndex: 0,
      label: "Comida",
      position: 0,
    });

    await options.addRecipeOption(TEST_TENANT_HOST, slot!.id, recipe.id);

    // All library media removed (or the recipe deleted) → keep the frozen image.
    await client.from("recipe_media").delete().eq("recipe_id", recipe.id);

    const tree = await cycles.getByIdWithTree(TEST_TENANT_HOST, cycleId);
    const option = tree?.slots[0]?.options[0]?.item_snapshot;

    expect(option?.images[0]?.url).toBe("https://cdn/frozen.jpg");
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

  it("renames a cycle and updates its start date; rejects a blank name", async () => {
    const cycleId = await draftFor(clientA);

    const renamed = await cycles.update(TEST_TENANT_HOST, cycleId, {
      name: "  Definición — Fase 2  ",
      startDate: "2026-08-01",
    });

    expect(renamed?.name).toBe("Definición — Fase 2"); // trimmed
    expect(renamed?.start_date).toBe("2026-08-01");

    await expect(
      cycles.update(TEST_TENANT_HOST, cycleId, { name: "   " })
    ).rejects.toBeInstanceOf(MealCycleValidationError);
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
