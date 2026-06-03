import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { MealCycleService } from "../meal-cycle-service";
import { MealSlotOptionService } from "../meal-slot-option-service";
import { getClientSelections, setClientSelection } from "../option-selection";

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

let clientA: number;
let clientB: number;

async function seedClient(email: string): Promise<number> {
  const { data, error } = await db
    .from("clients")
    .insert({ name: "Selection Test Client", email })
    .select("id")
    .single();

  if (error !== null) {
    throw new Error(`seedClient failed: ${error.message}`);
  }

  return (data as { id: number }).id;
}

/** A slot in an *active* cycle for `clientId`, with two recipe options. */
async function seedActiveSlotWithTwoOptions(
  clientId: number
): Promise<{ slotId: string; optionA: string; optionB: string }> {
  const recipe = await recipes.create(TEST_TENANT_HOST, TEST_TRAINER_ID, {
    name: "Opción base",
  });

  const cycle = await cycles.create(TEST_TENANT_HOST, {
    trainerId: TEST_TRAINER_ID,
    clientId,
    name: "Ciclo selección",
    durationDays: 3,
  });
  const slot = await cycles.addSlot(TEST_TENANT_HOST, cycle.id, {
    dayIndex: 0,
    label: "Desayuno",
  });

  const a = await options.addRecipeOption(
    TEST_TENANT_HOST,
    slot!.id,
    recipe.id
  );
  const b = await options.addRecipeOption(
    TEST_TENANT_HOST,
    slot!.id,
    recipe.id
  );

  await cycles.update(TEST_TENANT_HOST, cycle.id, { status: "active" });

  return { slotId: slot!.id, optionA: a!.id, optionB: b!.id };
}

describe("option-selection (integration, local DB)", () => {
  beforeAll(async () => {
    await ensureTestTenant(db);
    await ensureTestTrainer(db);
    clientA = await seedClient("sel-a@nutrition-v2-test.local");
    clientB = await seedClient("sel-b@nutrition-v2-test.local");
  });

  afterEach(async () => {
    await cleanNutritionTestData(db);
  });

  afterAll(async () => {
    await cleanNutritionTestData(db);
    await db.from("clients").delete().in("id", [clientA, clientB]);
  });

  it("persists a selection and re-reads it", async () => {
    const { slotId, optionA } = await seedActiveSlotWithTwoOptions(clientA);

    const saved = await setClientSelection(db, clientA, slotId, optionA);

    expect(saved).not.toBeNull();
    expect(saved?.option_id).toBe(optionA);

    const selections = await getClientSelections(db, clientA);

    expect(selections).toEqual([{ slot_id: slotId, option_id: optionA }]);
  });

  it("upserts on (client_id, slot_id) — changing the choice never duplicates", async () => {
    const { slotId, optionA, optionB } =
      await seedActiveSlotWithTwoOptions(clientA);

    await setClientSelection(db, clientA, slotId, optionA);
    await setClientSelection(db, clientA, slotId, optionB);

    const rows = await db
      .from("meal_slot_option_selections")
      .select("option_id")
      .eq("client_id", clientA)
      .eq("slot_id", slotId);

    // One standing choice per meal — the second set updated, not inserted.
    expect(rows.data ?? []).toHaveLength(1);
    expect((rows.data ?? [])[0]?.option_id).toBe(optionB);
  });

  it("rejects selecting on another client's slot (§4.4) — no row written", async () => {
    const { slotId, optionA } = await seedActiveSlotWithTwoOptions(clientA);

    // clientB tries to select on clientA's slot.
    expect(await setClientSelection(db, clientB, slotId, optionA)).toBeNull();
    expect(await getClientSelections(db, clientB)).toEqual([]);
  });

  it("rejects selecting on a slot that is not in an active cycle", async () => {
    const recipe = await recipes.create(TEST_TENANT_HOST, TEST_TRAINER_ID, {
      name: "Borrador",
    });
    const cycle = await cycles.create(TEST_TENANT_HOST, {
      trainerId: TEST_TRAINER_ID,
      clientId: clientA,
      name: "Ciclo borrador",
      durationDays: 3,
    });
    const slot = await cycles.addSlot(TEST_TENANT_HOST, cycle.id, {
      dayIndex: 0,
    });
    const option = await options.addRecipeOption(
      TEST_TENANT_HOST,
      slot!.id,
      recipe.id
    );

    // Cycle is still draft → not selectable.
    expect(
      await setClientSelection(db, clientA, slot!.id, option!.id)
    ).toBeNull();
  });

  it("rejects an option that does not belong to the slot", async () => {
    const { slotId } = await seedActiveSlotWithTwoOptions(clientA);
    const other = await seedActiveSlotWithTwoOptions(clientB);

    // optionA of clientB's slot is not in clientA's slot.
    expect(
      await setClientSelection(db, clientA, slotId, other.optionA)
    ).toBeNull();
  });
});
