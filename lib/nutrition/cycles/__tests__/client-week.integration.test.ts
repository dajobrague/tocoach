import type { ClientWeekDay } from "../client-week";

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { getActiveCycleTreeForClient } from "../client-cycle-reader";
import { buildClientWeek } from "../client-week";
import { MealCycleService } from "../meal-cycle-service";
import { MealSlotOptionService } from "../meal-slot-option-service";
import { OverrideService } from "../override-service";

import { shiftYmd } from "@/lib/nutrition/logs/log-window";
import { getMealLogs } from "@/lib/nutrition/logs/meal-log-service";
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
 * Week fetch resolution + canLog (P-week). Mirrors exactly what
 * GET /api/client/meal-cycle/week composes. Cycle starts mid-week, so the week
 * has not-started days, started base days, one swapped+noted day, and future
 * days — covering per-date resolution and the canLog boundaries.
 */

const WEEK_START = "2026-06-08"; // Monday
const CYCLE_START = "2026-06-10"; // Wednesday → days 06-08/06-09 are pre-start
const SWAP_DATE = "2026-06-11"; // rotation day 1
const TODAY = "2026-06-12"; // → 06-13/06-14 are future

const db = createSupabaseTestClient();
const recipes = new RecipeService(db);
const recipeIngredients = new RecipeIngredientService(db);
const cycles = new MealCycleService(db);
const options = new MealSlotOptionService(db);
const overrides = new OverrideService(db);

let clientId: number;

async function seedRecipe(name: string): Promise<string> {
  const recipe = await recipes.create(TEST_TENANT_HOST, TEST_TRAINER_ID, {
    name,
  });

  await recipeIngredients.add(TEST_TENANT_HOST, recipe.id, {
    name: "Ing",
    quantity: 100,
    unit: "g",
    nutrientsPer100g: { kcal: 100 },
  });

  return recipe.id;
}

async function week(): Promise<ClientWeekDay[]> {
  const tree = await getActiveCycleTreeForClient(db, clientId);
  const overrideRows = await overrides.listForCycle(TEST_TENANT_HOST, tree!.id);
  const logs = await getMealLogs(
    db,
    clientId,
    WEEK_START,
    shiftYmd(WEEK_START, 6)
  );

  return buildClientWeek(tree, overrideRows, logs, WEEK_START, TODAY, "UTC")
    .days;
}

function dayOf(days: ClientWeekDay[], date: string): ClientWeekDay {
  const day = days.find((d) => d.date === date);

  if (day === undefined) {
    throw new Error(`day ${date} not in week`);
  }

  return day;
}

describe("buildClientWeek (integration, local DB)", () => {
  let day0SlotId = "";

  beforeAll(async () => {
    await ensureTestTenant(db);
    await ensureTestTrainer(db);

    const { data, error } = await db
      .from("clients")
      .insert({
        name: "Week View Client",
        email: "weekview@nutrition-v2-test.local",
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

  it("resolves each date: not-started, base, swapped+noted, future canLog", async () => {
    const base0 = await seedRecipe("Dia 0 base");
    const base1 = await seedRecipe("Dia 1 base");
    const swapRecipe = await seedRecipe("Intercambio");

    const cycle = await cycles.create(TEST_TENANT_HOST, {
      trainerId: TEST_TRAINER_ID,
      clientId,
      name: "Ciclo semana",
      durationDays: 2,
      startDate: CYCLE_START,
    });
    const slot0 = await cycles.addSlot(TEST_TENANT_HOST, cycle.id, {
      dayIndex: 0,
      label: "Desayuno",
    });
    const slot1 = await cycles.addSlot(TEST_TENANT_HOST, cycle.id, {
      dayIndex: 1,
      label: "Desayuno",
    });

    day0SlotId = slot0!.id;
    await options.addRecipeOption(TEST_TENANT_HOST, slot0!.id, base0);
    await options.addRecipeOption(TEST_TENANT_HOST, slot1!.id, base1);
    await cycles.update(TEST_TENANT_HOST, cycle.id, { status: "active" });

    // A single_day swap + note, both on SWAP_DATE (rotation day 1).
    await overrides.create(TEST_TENANT_HOST, {
      cycleId: cycle.id,
      overrideType: "swap",
      scope: "single_day",
      anchorDate: SWAP_DATE,
      slotId: slot1!.id,
      swapSourceType: "recipe",
      swapSourceRefId: swapRecipe,
    });
    await overrides.create(TEST_TENANT_HOST, {
      cycleId: cycle.id,
      overrideType: "note",
      scope: "single_day",
      anchorDate: SWAP_DATE,
      noteText: "Pésate hoy",
    });

    // A log on the first started day (06-10, rotation day 0).
    await db.from("meal_logs").insert({
      tenant_host: TEST_TENANT_HOST,
      client_id: clientId,
      slot_id: slot0!.id,
      log_date: CYCLE_START,
      status: "eaten_planned",
    });

    const days = await week();

    expect(days).toHaveLength(7);

    // Pre-start days → clean not-started shape, never loggable.
    const preStart = dayOf(days, "2026-06-08");

    expect(preStart.started).toBe(false);
    expect(preStart.dayIndex).toBeNull();
    expect(preStart.slots).toEqual([]);
    expect(preStart.canLog).toBe(false);
    expect(dayOf(days, "2026-06-09").started).toBe(false);

    // 06-10: rotation day 0, base meal, the seeded log present, canLog (past).
    const d10 = dayOf(days, CYCLE_START);

    expect(d10.dayIndex).toBe(0);
    expect(d10.slots[0]?.options[0]?.item_snapshot.name).toBe("Dia 0 base");
    expect(d10.logs[day0SlotId]?.status).toBe("eaten_planned");
    expect(d10.canLog).toBe(true);
    expect(d10.notes).toEqual([]);

    // 06-11: rotation day 1, the SWAP replaces the option (frozen) + the note.
    const d11 = dayOf(days, SWAP_DATE);

    expect(d11.dayIndex).toBe(1);
    expect(d11.slots[0]?.options).toHaveLength(1);
    expect(d11.slots[0]?.options[0]?.item_snapshot.name).toBe("Intercambio");
    expect(d11.notes.map((n) => n.text)).toEqual(["Pésate hoy"]);
    expect(d11.canLog).toBe(true);

    // 06-13: rotation day 1 again, but the single_day swap does NOT apply here —
    // base meal, and it is in the future → not loggable.
    const d13 = dayOf(days, "2026-06-13");

    expect(d13.dayIndex).toBe(1);
    expect(d13.slots[0]?.options[0]?.item_snapshot.name).toBe("Dia 1 base");
    expect(d13.notes).toEqual([]);
    expect(d13.canLog).toBe(false);

    // 06-12 today → loggable; 06-14 future → not.
    expect(dayOf(days, TODAY).canLog).toBe(true);
    expect(dayOf(days, "2026-06-14").canLog).toBe(false);
  });
});
