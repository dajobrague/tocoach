import { expect, test } from "@playwright/test";

import {
  cleanLegacyNutritionTestData,
  seedLegacyNutrition,
} from "../../lib/test/legacy-nutrition-test-db";
import {
  TEST_TENANT_HOST,
  TEST_TRAINER_ID,
  cleanNutritionTestData,
  ensureTestTenant,
  ensureTestTrainer,
} from "../../lib/test/nutrition-test-db";
import { createSupabaseTestClient } from "../../lib/test/supabase-test-client";

import { addTrainerAuthCookie } from "./helpers/auth";

const client = createSupabaseTestClient();
const GOOD_RECIPE_NAME = "Pollo con arroz";

test.beforeAll(async () => {
  await ensureTestTenant(client);
  await ensureTestTrainer(client);

  // Make the test tenant look owned + onboarded so the dashboard shell renders.
  await client
    .from("tenants")
    .update({ trainer_id: TEST_TRAINER_ID, onboarding_completed: true })
    .eq("host", TEST_TENANT_HOST);

  // Start from a clean slate, then seed only legacy fixture data (no network).
  await cleanNutritionTestData(client);
  await cleanLegacyNutritionTestData(client);
  await seedLegacyNutrition(client);
});

test.afterAll(async () => {
  await cleanLegacyNutritionTestData(client);
  await cleanNutritionTestData(client);

  // Assert zero residue across both the new and the legacy fixtures.
  const recipes = await client
    .from("recipes")
    .select("id")
    .eq("tenant_host", TEST_TENANT_HOST);
  const plans = await client
    .from("nutrition_plans")
    .select("id")
    .eq("tenant_host", TEST_TENANT_HOST);

  expect(recipes.data ?? []).toHaveLength(0);
  expect(plans.data ?? []).toHaveLength(0);
});

test("trainer imports a recipe from old plans into the library", async ({
  page,
  context,
}) => {
  await addTrainerAuthCookie(context);

  console.log("[e2e] step 1 — open the guided importer");
  await page.goto("/trainer/dashboard/recipes/import");

  console.log("[e2e] step 2 — candidates render with the legacy stated macros");
  await expect(
    page.getByRole("heading", { name: "Importar de planes antiguos" })
  ).toBeVisible();
  await expect(page.getByText(GOOD_RECIPE_NAME)).toBeVisible();
  // "Plan original: 1050 kcal · 75P / 160C / 12G" from the seeded option.
  await expect(page.getByText(/Plan original: 1050 kcal/)).toBeVisible();

  console.log("[e2e] step 3 — select the candidate and import it");
  await page
    .getByRole("checkbox", { name: `Seleccionar ${GOOD_RECIPE_NAME}` })
    .check();
  await page.getByRole("button", { name: /Importar seleccionadas/ }).click();

  console.log("[e2e] step 4 — the import result is reported back");
  await expect(page.getByText("1 importada")).toBeVisible();

  console.log("[e2e] step 5 — the imported recipe appears in the library");
  await page.goto("/trainer/dashboard/recipes");
  await expect(page.getByText(GOOD_RECIPE_NAME)).toBeVisible();

  console.log("[e2e] journey complete");
});
