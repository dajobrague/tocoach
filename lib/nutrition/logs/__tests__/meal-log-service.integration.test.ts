import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { MealCycleService } from "../../cycles/meal-cycle-service";
import { MealSlotOptionService } from "../../cycles/meal-slot-option-service";
import { getMealLogs, setMealLog } from "../meal-log-service";

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
    .insert({ name: "Meal Log Test Client", email })
    .select("id")
    .single();

  if (error !== null) {
    throw new Error(`seedClient failed: ${error.message}`);
  }

  return (data as { id: number }).id;
}

/** A slot in an *active* cycle for `clientId`, with one recipe option. */
async function seedActiveSlot(
  clientId: number
): Promise<{ slotId: string; optionId: string }> {
  const recipe = await recipes.create(TEST_TENANT_HOST, TEST_TRAINER_ID, {
    name: "Log recipe",
  });
  const cycle = await cycles.create(TEST_TENANT_HOST, {
    trainerId: TEST_TRAINER_ID,
    clientId,
    name: "Ciclo log",
    durationDays: 3,
  });
  const slot = await cycles.addSlot(TEST_TENANT_HOST, cycle.id, {
    dayIndex: 0,
    label: "Desayuno",
  });
  const option = await options.addRecipeOption(
    TEST_TENANT_HOST,
    slot!.id,
    recipe.id
  );

  await cycles.update(TEST_TENANT_HOST, cycle.id, { status: "active" });

  return { slotId: slot!.id, optionId: option!.id };
}

describe("meal-log-service (integration, local DB)", () => {
  beforeAll(async () => {
    await ensureTestTenant(db);
    await ensureTestTrainer(db);
    clientA = await seedClient("log-a@nutrition-v2-test.local");
    clientB = await seedClient("log-b@nutrition-v2-test.local");
  });

  afterEach(async () => {
    await cleanNutritionTestData(db);
  });

  afterAll(async () => {
    await cleanNutritionTestData(db);
    await db.from("clients").delete().in("id", [clientA, clientB]);
  });

  it("logs an eaten_planned meal with option, comment and photo", async () => {
    const { slotId, optionId } = await seedActiveSlot(clientA);

    const row = await setMealLog(db, clientA, {
      slotId,
      logDate: "2026-06-03",
      status: "eaten_planned",
      optionId,
      comment: "Estuvo rico",
      photoUrl: "https://cdn/meal.jpg",
    });

    expect(row).not.toBeNull();
    expect(row?.status).toBe("eaten_planned");
    expect(row?.option_id).toBe(optionId);
    expect(row?.comment).toBe("Estuvo rico");
    expect(row?.photo_url).toBe("https://cdn/meal.jpg");

    const logs = await getMealLogs(db, clientA, "2026-06-01", "2026-06-30");

    expect(logs).toHaveLength(1);
    expect(logs[0]?.slot_id).toBe(slotId);
  });

  it("logs a skipped meal (no option needed)", async () => {
    const { slotId } = await seedActiveSlot(clientA);

    const row = await setMealLog(db, clientA, {
      slotId,
      logDate: "2026-06-03",
      status: "skipped",
    });

    expect(row?.status).toBe("skipped");
    expect(row?.option_id).toBeNull();
  });

  it("logs an eaten_other meal", async () => {
    const { slotId } = await seedActiveSlot(clientA);

    const row = await setMealLog(db, clientA, {
      slotId,
      logDate: "2026-06-03",
      status: "eaten_other",
      comment: "Comí fuera",
    });

    expect(row?.status).toBe("eaten_other");
  });

  it("upserts on (client_id, slot_id, log_date) — one log per meal per day", async () => {
    const { slotId } = await seedActiveSlot(clientA);

    await setMealLog(db, clientA, {
      slotId,
      logDate: "2026-06-03",
      status: "skipped",
    });
    await setMealLog(db, clientA, {
      slotId,
      logDate: "2026-06-03",
      status: "eaten_planned",
    });

    const rows = await db
      .from("meal_logs")
      .select("status")
      .eq("client_id", clientA)
      .eq("slot_id", slotId)
      .eq("log_date", "2026-06-03");

    expect(rows.data ?? []).toHaveLength(1);
    expect((rows.data ?? [])[0]?.status).toBe("eaten_planned");
  });

  it("keeps separate logs per day for the same slot", async () => {
    const { slotId } = await seedActiveSlot(clientA);

    await setMealLog(db, clientA, {
      slotId,
      logDate: "2026-06-03",
      status: "eaten_planned",
    });
    await setMealLog(db, clientA, {
      slotId,
      logDate: "2026-06-04",
      status: "skipped",
    });

    expect(
      await getMealLogs(db, clientA, "2026-06-03", "2026-06-04")
    ).toHaveLength(2);
    // Range filter excludes out-of-range days.
    expect(
      await getMealLogs(db, clientA, "2026-06-04", "2026-06-04")
    ).toHaveLength(1);
  });

  it("rejects logging on another client's slot (§4.4) — no row written", async () => {
    const { slotId } = await seedActiveSlot(clientA);

    expect(
      await setMealLog(db, clientB, {
        slotId,
        logDate: "2026-06-03",
        status: "skipped",
      })
    ).toBeNull();
    expect(await getMealLogs(db, clientB, "2026-06-01", "2026-06-30")).toEqual(
      []
    );
  });

  it("rejects logging on a slot not in an active cycle", async () => {
    const cycle = await cycles.create(TEST_TENANT_HOST, {
      trainerId: TEST_TRAINER_ID,
      clientId: clientA,
      name: "Borrador",
      durationDays: 3,
    });
    const slot = await cycles.addSlot(TEST_TENANT_HOST, cycle.id, {
      dayIndex: 0,
    });

    expect(
      await setMealLog(db, clientA, {
        slotId: slot!.id,
        logDate: "2026-06-03",
        status: "skipped",
      })
    ).toBeNull();
  });

  it("rejects an option that does not belong to the slot", async () => {
    const { slotId } = await seedActiveSlot(clientA);
    const other = await seedActiveSlot(clientB);

    expect(
      await setMealLog(db, clientA, {
        slotId,
        logDate: "2026-06-03",
        status: "eaten_planned",
        optionId: other.optionId,
      })
    ).toBeNull();
  });
});
