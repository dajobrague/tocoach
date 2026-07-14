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

const RECIPE_NAME = "E2E Avena del cliente";
const RECIPE_STEPS = "Mezclar la avena con la leche y servir.";
const INGREDIENT_NAME = "Avena";
const CYCLE_NAME = "E2E Plan del cliente";
const SLOT_LABEL = "Desayuno";
const PLAN_PATH = `/${TEST_TENANT_SLUG}/plan-de-comidas`;

test.beforeAll(async () => {
  await ensureTestTenant(db);
  await ensureTestTrainer(db);
  await ensureTestClient(db);

  // The slug must validate (status='active') for the middleware to serve the
  // client route; ensureTestTenant leaves it 'inactive' for safety, so flip it
  // active here and restore in afterAll.
  await db
    .from("tenants")
    .update({ trainer_id: TEST_TRAINER_ID, status: "active" })
    .eq("host", TEST_TENANT_HOST);

  await cleanNutritionTestData(db);

  // Recipe with steps, one macro-bearing ingredient, and image + vertical video
  // media — so the frozen option snapshot is fully self-contained.
  const recipe = await recipes.create(TEST_TENANT_HOST, TEST_TRAINER_ID, {
    name: RECIPE_NAME,
    status: "active",
  });

  await db
    .from("recipes")
    .update({ instructions: RECIPE_STEPS })
    .eq("id", recipe.id);
  await recipeIngredients.add(TEST_TENANT_HOST, recipe.id, {
    name: INGREDIENT_NAME,
    quantity: 100,
    unit: "g",
    nutrientsPer100g: { kcal: 380, protein_g: 13 },
  });
  await db.from("recipe_media").insert([
    {
      recipe_id: recipe.id,
      type: "image",
      url: "https://cdn/avena.jpg",
      orientation: "horizontal",
      sort_order: 0,
    },
    {
      recipe_id: recipe.id,
      type: "video",
      url: "https://cdn/avena-reel.mp4",
      orientation: "vertical",
      sort_order: 1,
    },
  ]);

  // One-day cycle starting today → day 0 is always "today" (no tz/day flake).
  const cycle = await cycles.create(TEST_TENANT_HOST, {
    trainerId: TEST_TRAINER_ID,
    clientId: TEST_CLIENT_ID,
    name: CYCLE_NAME,
    durationDays: 1,
  });
  const slot = await cycles.addSlot(TEST_TENANT_HOST, cycle.id, {
    dayIndex: 0,
    label: SLOT_LABEL,
  });

  // Two options → the slot is multi-option, so the client must choose one.
  await options.addRecipeOption(TEST_TENANT_HOST, slot!.id, recipe.id);
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

  const cyclesLeft = await db
    .from("meal_cycles")
    .select("id")
    .eq("tenant_host", TEST_TENANT_HOST);
  const selectionsLeft = await db
    .from("meal_slot_option_selections")
    .select("id")
    .eq("tenant_host", TEST_TENANT_HOST);

  expect(cyclesLeft.data ?? []).toHaveLength(0);
  expect(selectionsLeft.data ?? []).toHaveLength(0);
});

test("client opens their plan, views a recipe, and picks an option that persists", async ({
  page,
  context,
}) => {
  console.log("[e2e] step 1 — client logs in (mint client-session cookie)");
  await addClientAuthCookie(context);

  console.log("[e2e] step 2 — open the portal plan page");
  await page.goto(PLAN_PATH);

  console.log(
    "[e2e] step 3 — the week selector lands on today and meals render"
  );
  // The page opens straight on the week selector (the plan-name header was
  // removed by design, Jul 2026): it defaults to today (its "Hoy" subtitle),
  // and the selected day's meals render in the day panel.
  await expect(page.getByText("Hoy", { exact: true })).toBeVisible();
  await expect(page.getByTestId("day-panel")).toBeVisible();
  await expect(page.getByText(SLOT_LABEL)).toBeVisible();
  await expect(page.getByTestId("option-card")).toHaveCount(2);

  console.log(
    "[e2e] step 4 — open a recipe detail (ingredients + steps from snapshot)"
  );
  await page.getByTestId("option-open").first().click();
  const detail = page.getByTestId("recipe-detail");

  await expect(detail).toBeVisible();
  // Exact match: the steps sentence also contains "avena".
  await expect(
    detail.getByText(INGREDIENT_NAME, { exact: true })
  ).toBeVisible();
  await expect(detail.getByText(RECIPE_STEPS)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(detail).toBeHidden();

  console.log("[e2e] step 5 — pick the second option; it is marked selected");
  const secondCard = page.getByTestId("option-card").nth(1);
  const selectionSaved = page.waitForResponse(
    (res) =>
      res.url().includes("/api/client/meal-cycle/selection") &&
      res.request().method() === "POST" &&
      res.ok()
  );

  await secondCard.getByTestId("option-select").click();
  await selectionSaved;
  await expect(secondCard).toHaveAttribute("data-selected", "true");

  console.log("[e2e] step 6 — reload: the selection persisted");
  await page.reload();
  await expect(page.getByText(SLOT_LABEL)).toBeVisible();
  await expect(page.getByTestId("option-card").nth(1)).toHaveAttribute(
    "data-selected",
    "true"
  );
  await expect(page.getByTestId("option-card").first()).toHaveAttribute(
    "data-selected",
    "false"
  );

  console.log("[e2e] journey complete — selection round-trips on reload");
});
