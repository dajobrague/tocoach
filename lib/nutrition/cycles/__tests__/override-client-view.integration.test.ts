import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { getActiveCycleTreeForClient } from "../client-cycle-reader";
import { buildClientCycleView } from "../cycle-day";
import { MealCycleService } from "../meal-cycle-service";
import { MealSlotOptionService } from "../meal-slot-option-service";
import { applyOverridesToClientView } from "../override-client-view";
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

/**
 * The client fetch resolves overrides (P7-T4): seed a cycle + a single_day swap
 * and a note on TODAY → the resolved view shows the swapped option (from the
 * frozen snapshot) and the note; a swap anchored on another day does not touch
 * today. Mirrors exactly what GET /api/client/meal-cycle composes.
 */

const TODAY = "2026-06-10";
const OTHER_DAY = "2026-06-11";

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

/** Resolve the client's today view exactly as the route does. */
async function resolvedView(dateYmd: string) {
  const tree = await getActiveCycleTreeForClient(db, clientId);
  const overrideRows = await overrides.listForCycle(TEST_TENANT_HOST, tree!.id);
  const base = buildClientCycleView(tree, dateYmd, "UTC", [], []);

  return applyOverridesToClientView(base, tree, overrideRows, dateYmd, "UTC");
}

describe("client view resolves overrides (integration, local DB)", () => {
  beforeAll(async () => {
    await ensureTestTenant(db);
    await ensureTestTrainer(db);

    const { data, error } = await db
      .from("clients")
      .insert({
        name: "Override View Client",
        email: "overrideview@nutrition-v2-test.local",
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

  it("shows today's swapped option + note, and ignores another day's swap", async () => {
    const baseRecipe = await seedRecipe("Plan base");
    const todaySwapRecipe = await seedRecipe("Intercambio de hoy");
    const otherDaySwapRecipe = await seedRecipe("Intercambio de mañana");

    // 1-day active cycle starting TODAY → every date is rotation day 0.
    const cycle = await cycles.create(TEST_TENANT_HOST, {
      trainerId: TEST_TRAINER_ID,
      clientId,
      name: "Ciclo overrides",
      durationDays: 1,
      startDate: TODAY,
    });
    const slot = await cycles.addSlot(TEST_TENANT_HOST, cycle.id, {
      dayIndex: 0,
      label: "Desayuno",
    });

    await options.addRecipeOption(TEST_TENANT_HOST, slot!.id, baseRecipe);
    await cycles.update(TEST_TENANT_HOST, cycle.id, { status: "active" });

    // A swap + a note on TODAY, and a swap on ANOTHER day (same slot).
    await overrides.create(TEST_TENANT_HOST, {
      cycleId: cycle.id,
      overrideType: "swap",
      scope: "single_day",
      anchorDate: TODAY,
      slotId: slot!.id,
      swapSourceType: "recipe",
      swapSourceRefId: todaySwapRecipe,
    });
    await overrides.create(TEST_TENANT_HOST, {
      cycleId: cycle.id,
      overrideType: "note",
      scope: "single_day",
      anchorDate: TODAY,
      noteText: "Toma tu creatina",
    });
    await overrides.create(TEST_TENANT_HOST, {
      cycleId: cycle.id,
      overrideType: "swap",
      scope: "single_day",
      anchorDate: OTHER_DAY,
      slotId: slot!.id,
      swapSourceType: "recipe",
      swapSourceRefId: otherDaySwapRecipe,
    });

    const view = await resolvedView(TODAY);
    const todaySlot = view.days
      .find((d) => d.dayIndex === 0)!
      .slots.find((s) => s.id === slot!.id)!;

    // The swap replaced the base option with the frozen TODAY snapshot.
    expect(todaySlot.options).toHaveLength(1);
    expect(todaySlot.options[0]?.item_snapshot.name).toBe("Intercambio de hoy");
    // The note for today is attached.
    expect(view.notes).toEqual([
      expect.objectContaining({ text: "Toma tu creatina", slotId: null }),
    ]);

    // Resolving the OTHER day shows that day's swap instead — proving date scope.
    const otherView = await resolvedView(OTHER_DAY);
    const otherSlot = otherView.days
      .find((d) => d.dayIndex === 0)!
      .slots.find((s) => s.id === slot!.id)!;

    expect(otherSlot.options[0]?.item_snapshot.name).toBe(
      "Intercambio de mañana"
    );
  });
});
