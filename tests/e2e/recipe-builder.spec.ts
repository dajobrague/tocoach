import { expect, test } from "@playwright/test";

import {
  TEST_TENANT_HOST,
  TEST_TRAINER_ID,
  cleanNutritionTestData,
  ensureTestTenant,
  ensureTestTrainer,
} from "../../lib/test/nutrition-test-db";
import { createSupabaseTestClient } from "../../lib/test/supabase-test-client";

import { addTrainerAuthCookie } from "./helpers/auth";

const RECIPE_NAME = "E2E Manual Recipe";
const client = createSupabaseTestClient();

test.beforeAll(async () => {
  await ensureTestTenant(client);
  await ensureTestTrainer(client);

  // Make the test tenant look owned + onboarded so the nav shell renders the
  // page instead of bouncing to /setup. (recipes FK to tenants.host already
  // satisfied by ensureTestTenant.)
  await client
    .from("tenants")
    .update({ trainer_id: TEST_TRAINER_ID, onboarding_completed: true })
    .eq("host", TEST_TENANT_HOST);

  await cleanNutritionTestData(client);
});

test.afterAll(async () => {
  await cleanNutritionTestData(client);

  const { data } = await client
    .from("recipes")
    .select("id")
    .eq("tenant_host", TEST_TENANT_HOST);

  expect(data ?? []).toHaveLength(0);
});

test("trainer builds a recipe via the manual ingredient path", async ({
  page,
  context,
}) => {
  // Authenticate by minting the trainer-session cookie directly (no UI login).
  await addTrainerAuthCookie(context);

  console.log("[e2e] step 1 — open /recipes/new and create the draft");
  await page.goto("/trainer/dashboard/recipes/new");
  await page.getByLabel("Nombre").fill(RECIPE_NAME);
  await page.getByRole("button", { name: "Crear receta" }).click();

  await page.waitForURL(/\/trainer\/dashboard\/recipes\/.+\/edit/);
  console.log(`[e2e] step 2 — landed on the edit page: ${page.url()}`);

  console.log("[e2e] step 3 — open the manual ingredient form");
  await page.getByRole("button", { name: /Agrégalo manualmente/ }).click();
  const manualForm = page.getByTestId("manual-ingredient-form");
  await expect(manualForm).toBeVisible();

  console.log(
    "[e2e] step 4 — enter 200 g of a 100 kcal/100g, 10 g protein/100g food"
  );
  await manualForm.getByLabel("Nombre").fill("E2E Manual Oats");
  await manualForm.getByLabel("Cantidad").fill("200");
  await manualForm.getByLabel("Calorías").fill("100");
  await manualForm.getByLabel("Proteína (g)").fill("10");
  await manualForm
    .getByRole("button", { name: "Añadir ingrediente manual" })
    .click();

  console.log(
    "[e2e] step 5 — assert macro summary shows the computed totals (200 kcal / 20 g protein)"
  );
  await expect(page.getByText("200 kcal")).toBeVisible();
  await expect(page.getByText("20 g")).toBeVisible();

  console.log("[e2e] step 6 — recipe appears in the library");
  await page.goto("/trainer/dashboard/recipes");
  await expect(page.getByText(RECIPE_NAME)).toBeVisible();

  console.log("[e2e] journey complete");
});
