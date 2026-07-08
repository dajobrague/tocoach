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

import {
  addClientAuthCookie,
  addTrainerAuthCookie,
  TEST_TENANT_SLUG,
} from "./helpers/auth";

// Pin the browser timezone to UTC so the client's logged date, the planned days
// (computed in UTC), and the trainer's adherence range all agree on "today".
test.use({ timezoneId: "UTC" });

const db = createSupabaseTestClient();
const recipes = new RecipeService(db);
const recipeIngredients = new RecipeIngredientService(db);
const cycles = new MealCycleService(db);
const options = new MealSlotOptionService(db);

const RECIPE_NAME = "E2E Avena (adherencia)";
const CYCLE_NAME = "E2E Plan adherencia";
const SLOT_LABEL = "Desayuno";
const COMMENT = "Quedó delicioso, lo repetiré";
const PHOTO_BUCKET = "meal-photos";
const PLAN_PATH = `/${TEST_TENANT_SLUG}/plan-de-comidas`;
const PROFILE_PATH = `/trainer/dashboard/clients/${TEST_CLIENT_ID}`;

// A tiny valid 1x1 PNG — the meal photo fixture (no file on disk needed).
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

function isMealLogPost(res: {
  url(): string;
  request(): { method(): string };
}) {
  return (
    new URL(res.url()).pathname === "/api/client/meal-logs" &&
    res.request().method() === "POST"
  );
}

test.beforeAll(async () => {
  await ensureTestTenant(db);
  await ensureTestTrainer(db);
  await ensureTestClient(db);

  // Tenant must be active so the middleware serves the client slug route, and
  // owned + onboarded so the trainer dashboard/profile render.
  await db
    .from("tenants")
    .update({
      trainer_id: TEST_TRAINER_ID,
      status: "active",
      onboarding_completed: true,
    })
    .eq("host", TEST_TENANT_HOST);
  // The client is owned by the trainer via clients.tenant — required by the
  // profile API and the adherence ownership check (§4.4 trainer side).
  await db
    .from("clients")
    .update({ tenant: TEST_TRAINER_ID })
    .eq("id", TEST_CLIENT_ID);

  await cleanNutritionTestData(db);

  const recipe = await recipes.create(TEST_TENANT_HOST, TEST_TRAINER_ID, {
    name: RECIPE_NAME,
    status: "active",
  });

  await recipeIngredients.add(TEST_TENANT_HOST, recipe.id, {
    name: "Avena",
    quantity: 100,
    unit: "g",
    nutrientsPer100g: { kcal: 380, protein_g: 13 },
  });

  // One-day cycle starting today with a single planned option (the "plan").
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

  await options.addRecipeOption(TEST_TENANT_HOST, slot!.id, recipe.id);
  await cycles.update(TEST_TENANT_HOST, cycle.id, { status: "active" });
});

test.afterAll(async () => {
  // Remove the uploaded meal photo object(s) under the client's path.
  const folder = `${TEST_CLIENT_ID}`;
  const { data: objects } = await db.storage.from(PHOTO_BUCKET).list(folder);

  if (objects && objects.length > 0) {
    await db.storage
      .from(PHOTO_BUCKET)
      .remove(objects.map((o) => `${folder}/${o.name}`));
  }

  await cleanNutritionTestData(db);
  await removeTestClient(db);
  await db
    .from("tenants")
    .update({ status: "inactive" })
    .eq("host", TEST_TENANT_HOST);

  // Assert zero residue.
  const cyclesLeft = await db
    .from("meal_cycles")
    .select("id")
    .eq("tenant_host", TEST_TENANT_HOST);
  const logsLeft = await db
    .from("meal_logs")
    .select("id")
    .eq("tenant_host", TEST_TENANT_HOST);
  const { data: photosLeft } = await db.storage.from(PHOTO_BUCKET).list(folder);

  expect(cyclesLeft.data ?? []).toHaveLength(0);
  expect(logsLeft.data ?? []).toHaveLength(0);
  expect(photosLeft ?? []).toHaveLength(0);
});

// Skipped Jul 2026: the client-side log buttons ("Comí el plan" / "No comí")
// were removed by product decision — the client's menu choice + selections are
// the record now. The meal-logs API stays for history; re-enable if a logging
// UI ever returns.
test.skip("client logs a meal end-to-end and the trainer sees it in adherence", async ({
  page,
  context,
}) => {
  console.log("[e2e] step 1 — client logs in and opens the plan page");
  await addClientAuthCookie(context);
  await page.goto(PLAN_PATH);
  await expect(page.getByRole("heading", { name: CYCLE_NAME })).toBeVisible();
  await expect(page.getByTestId("meal-log-control")).toBeVisible();

  console.log("[e2e] step 2 — log the meal as 'ate the plan'");
  const planLogged = page.waitForResponse(
    (res) => isMealLogPost(res) && res.ok()
  );

  await page.getByTestId("log-eaten_planned").click();
  await planLogged;
  await expect(page.getByTestId("log-eaten_planned")).toHaveAttribute(
    "data-active",
    "true"
  );

  console.log("[e2e] step 3 — add a comment");
  const commentLogged = page.waitForResponse(
    (res) => isMealLogPost(res) && res.ok()
  );

  await page.getByTestId("log-comment").fill(COMMENT);
  await page.keyboard.press("Tab"); // blur → persists the comment
  await commentLogged;

  console.log("[e2e] step 4 — attach a photo (uploads via the photo route)");
  const photoUploaded = page.waitForResponse(
    (res) =>
      new URL(res.url()).pathname === "/api/client/meal-logs/photo" &&
      res.request().method() === "POST" &&
      res.ok()
  );
  const photoLogged = page.waitForResponse(
    (res) => isMealLogPost(res) && res.ok()
  );

  await page.getByTestId("log-photo-input").setInputFiles({
    name: "meal.png",
    mimeType: "image/png",
    buffer: PNG_1X1,
  });
  await photoUploaded;
  await photoLogged;

  console.log("[e2e] step 5 — reload: the meal shows its logged state");
  await page.reload();
  await expect(page.getByTestId("log-eaten_planned")).toHaveAttribute(
    "data-active",
    "true"
  );
  await expect(page.getByTestId("log-comment")).toHaveValue(COMMENT);
  // The photo thumbnail (alt "Foto de la comida") renders from the saved log.
  await expect(page.getByAltText("Foto de la comida")).toBeVisible();

  console.log("[e2e] step 6 — trainer logs in and opens the client's profile");
  await addTrainerAuthCookie(context);
  await page.goto(PROFILE_PATH);
  await page.getByRole("tab", { name: "Nutrición" }).click();

  console.log("[e2e] step 7 — open the Adherencia tab");
  await page.getByRole("tab", { name: "Adherencia" }).click();

  console.log("[e2e] step 8 — the logged meal appears with comment + photo");
  const loggedMeal = page.getByTestId("logged-meal").first();

  await expect(loggedMeal).toBeVisible();
  await expect(loggedMeal.getByText(COMMENT)).toBeVisible();
  await expect(loggedMeal.locator("img")).toBeVisible();

  console.log("[e2e] step 9 — both metrics register the planned-eaten log");
  await expect(page.getByTestId("metric-engagementPct")).toHaveText("100%");
  await expect(page.getByTestId("metric-adherencePct")).toHaveText("100%");

  console.log("[e2e] journey complete — trainer sees the client's log");
});
