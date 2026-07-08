import { expect, test } from "@playwright/test";

import { MealCycleService } from "../../lib/nutrition/cycles/meal-cycle-service";
import { MealSlotOptionService } from "../../lib/nutrition/cycles/meal-slot-option-service";
import { RecipeIngredientService } from "../../lib/nutrition/recipes/recipe-ingredient-service";
import { RecipeService } from "../../lib/nutrition/recipes/recipe-service";
import {
  TEST_CLIENT_ID,
  TEST_TENANT_HOST,
  TEST_TRAINER_ID,
  cleanNutritionTestData,
  ensureTestClient,
  ensureTestTenant,
  ensureTestTrainer,
  removeTestClient,
} from "../../lib/test/nutrition-test-db";
import { createSupabaseTestClient } from "../../lib/test/supabase-test-client";

import { addClientAuthCookie, TEST_TENANT_SLUG } from "./helpers/auth";

const db = createSupabaseTestClient();
const recipes = new RecipeService(db);
const recipeIngredients = new RecipeIngredientService(db);
const cycles = new MealCycleService(db);
const options = new MealSlotOptionService(db);

const CYCLE_NAME = "E2E Lista de compras";
const PLAN_PATH = `/${TEST_TENANT_SLUG}/plan-de-comidas`;

// Per-day ingredient lines. The same name appears in BOTH g and ml — those must
// stay separate after merging. A 1-day cycle means every date in the week lands
// on day 0, so each picked day contributes the same per-day quantities; picking
// 2 days doubles the summable lines.
const PER_DAY = {
  oatsG: 50,
  milkMl: 200,
  milkG: 100,
};
const PICKED_DAYS = 2;

/** Start the cycle safely in the past so any 7-day window is fully on/after it. */
function startDateInPast(): string {
  return new Date(Date.now() - 10 * 86_400_000).toISOString().slice(0, 10);
}

test.beforeAll(async () => {
  await ensureTestTenant(db);
  await ensureTestTrainer(db);
  await ensureTestClient(db);

  // The slug must validate (status='active') for the middleware to serve the
  // client route; restore to 'inactive' in afterAll.
  await db
    .from("tenants")
    .update({ trainer_id: TEST_TRAINER_ID, status: "active" })
    .eq("host", TEST_TENANT_HOST);

  await cleanNutritionTestData(db);

  // One recipe whose snapshot carries three ingredient lines, including a g and
  // an ml line of the SAME name (Leche) to prove units never merge.
  const recipe = await recipes.create(TEST_TENANT_HOST, TEST_TRAINER_ID, {
    name: "E2E Avena con leche",
    status: "active",
  });

  await recipeIngredients.add(TEST_TENANT_HOST, recipe.id, {
    name: "Avena",
    quantity: PER_DAY.oatsG,
    unit: "g",
  });
  await recipeIngredients.add(TEST_TENANT_HOST, recipe.id, {
    name: "Leche",
    quantity: PER_DAY.milkMl,
    unit: "ml",
  });
  await recipeIngredients.add(TEST_TENANT_HOST, recipe.id, {
    name: "Leche",
    quantity: PER_DAY.milkG,
    unit: "g",
  });

  // 1-day active cycle starting in the past: every date maps to day 0.
  const cycle = await cycles.create(TEST_TENANT_HOST, {
    trainerId: TEST_TRAINER_ID,
    clientId: TEST_CLIENT_ID,
    name: CYCLE_NAME,
    durationDays: 1,
    startDate: startDateInPast(),
  });
  const slot = await cycles.addSlot(TEST_TENANT_HOST, cycle.id, {
    dayIndex: 0,
    label: "Desayuno",
  });

  // A single option → it is the slot's first option, so it is what the shopping
  // list aggregates (no client selection needed).
  await options.addRecipeOption(TEST_TENANT_HOST, slot!.id, recipe.id);
  await cycles.update(TEST_TENANT_HOST, cycle.id, { status: "active" });
});

test.afterAll(async () => {
  await cleanNutritionTestData(db);
  await removeTestClient(db);

  // Restore the safety default so the test tenant is never served as a real one.
  await db
    .from("tenants")
    .update({ status: "inactive" })
    .eq("host", TEST_TENANT_HOST);

  // Zero residue across the nutrition tables this spec wrote to.
  const cyclesLeft = await db
    .from("meal_cycles")
    .select("id")
    .eq("tenant_host", TEST_TENANT_HOST);
  const optionsLeft = await db
    .from("meal_slot_options")
    .select("id")
    .eq("tenant_host", TEST_TENANT_HOST);
  const recipesLeft = await db
    .from("recipes")
    .select("id")
    .eq("tenant_host", TEST_TENANT_HOST);

  expect(cyclesLeft.data ?? []).toHaveLength(0);
  expect(optionsLeft.data ?? []).toHaveLength(0);
  expect(recipesLeft.data ?? []).toHaveLength(0);
});

// Skipped Jul 2026: the shopping-list entry point was removed from the client
// UI by product decision. The API + wizard components stay (unit/integration
// tested); re-enable if the feature returns.
test.skip("client picks meals in the wizard and sees the merged list", async ({
  page,
  context,
}) => {
  // The list comes ONLY from the picked meals: 2 picked days × per-day qty;
  // the two Leche lines (g and ml) stay split.
  const expectedOats = PER_DAY.oatsG * PICKED_DAYS; // 100 g
  const expectedMilkMl = PER_DAY.milkMl * PICKED_DAYS; // 400 ml
  const expectedMilkG = PER_DAY.milkG * PICKED_DAYS; // 200 g

  console.log("[e2e] step 1 — client logs in (mint client-session cookie)");
  await addClientAuthCookie(context);

  console.log("[e2e] step 2 — open the plan page (v2 nutrition view)");
  await page.goto(PLAN_PATH);
  // The plan-name header was removed by design (Jul 2026); the wizard button
  // rendering is the "page loaded" signal now.
  await expect(page.getByTestId("open-shopping-wizard")).toBeVisible();

  console.log("[e2e] step 3 — open the shopping wizard");
  await page.getByTestId("open-shopping-wizard").click();
  await expect(page.getByTestId("wizard-picker")).toBeVisible();

  console.log("[e2e] step 4 — pick the meal on two different days");
  const toggles = page.getByTestId("wizard-meal-toggle");

  await toggles.nth(0).click();
  await toggles.nth(1).click();
  await expect(toggles.nth(0)).toHaveAttribute("data-picked", "true");
  await page.getByTestId("wizard-generate").click();

  console.log("[e2e] step 5 — the list merges ONLY the picked meals");
  const list = page.getByTestId("shopping-list");

  await expect(list).toBeVisible();
  await expect(list.getByTestId("shopping-item")).toHaveCount(3);
  await expect(list.getByText(`Avena · ${expectedOats} g`)).toBeVisible();
  await expect(list.getByText(`Leche · ${expectedMilkG} g`)).toBeVisible();
  await expect(list.getByText(`Leche · ${expectedMilkMl} ml`)).toBeVisible();

  console.log("[e2e] step 6 — checking an item off de-emphasizes it");
  const oats = list
    .getByTestId("shopping-item")
    .filter({ hasText: `Avena · ${expectedOats} g` });

  await expect(oats).toHaveAttribute("data-checked", "false");
  await oats.click();
  await expect(oats).toHaveAttribute("data-checked", "true");

  console.log("[e2e] journey complete — list built from picks, units separate");
});
