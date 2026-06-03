import { expect, test } from "@playwright/test";

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

import { addTrainerAuthCookie } from "./helpers/auth";

const client = createSupabaseTestClient();
const recipes = new RecipeService(client);
const recipeIngredients = new RecipeIngredientService(client);

const RECIPE_NAME = "E2E Snapshot Pollo";
const ORIGINAL_KCAL = 200; // 200 g of a 100 kcal/100 g ingredient
const EDITED_KCAL = 777;

const NUTRITION_PATH = `/trainer/dashboard/clients/${TEST_CLIENT_ID}/nutrition`;

let recipeId: string;

test.beforeAll(async () => {
  await ensureTestTenant(client);
  await ensureTestTrainer(client);
  await ensureTestClient(client);

  // Make the test tenant look owned + onboarded so the dashboard shell renders.
  await client
    .from("tenants")
    .update({ trainer_id: TEST_TRAINER_ID, onboarding_completed: true })
    .eq("host", TEST_TENANT_HOST);

  await cleanNutritionTestData(client);

  // Seed a recipe whose computed total is ORIGINAL_KCAL.
  const recipe = await recipes.create(TEST_TENANT_HOST, TEST_TRAINER_ID, {
    name: RECIPE_NAME,
    status: "active",
  });

  recipeId = recipe.id;
  await recipeIngredients.add(TEST_TENANT_HOST, recipeId, {
    name: "Pollo",
    quantity: 200,
    unit: "g",
    nutrientsPer100g: { kcal: 100 },
  });
});

test.afterAll(async () => {
  await cleanNutritionTestData(client);
  await removeTestClient(client);

  const cyclesLeft = await client
    .from("meal_cycles")
    .select("id")
    .eq("tenant_host", TEST_TENANT_HOST);
  const recipesLeft = await client
    .from("recipes")
    .select("id")
    .eq("tenant_host", TEST_TENANT_HOST);

  expect(cyclesLeft.data ?? []).toHaveLength(0);
  expect(recipesLeft.data ?? []).toHaveLength(0);
});

test("§4.1 — an assigned option keeps its frozen macros after the recipe is edited", async ({
  page,
  context,
}) => {
  await addTrainerAuthCookie(context);

  console.log("[e2e] step 1 — open the per-client cycle builder");
  await page.goto(NUTRITION_PATH);

  console.log("[e2e] step 2 — create a cycle");
  await page.getByLabel("Nombre").fill("E2E Ciclo");
  await page.getByLabel("Duración (días)").fill("3");
  await page.getByRole("button", { name: "Crear ciclo" }).click();
  await expect(page.getByRole("heading", { name: "E2E Ciclo" })).toBeVisible();

  console.log("[e2e] step 3 — add a slot to day 1");
  await page
    .getByTestId("day-column")
    .first()
    .getByRole("button", { name: "Añadir comida" })
    .click();
  await expect(page.getByTestId("slot-card").first()).toBeVisible();

  console.log("[e2e] step 4 — open the picker and add the recipe as an option");
  await page
    .getByTestId("slot-card")
    .first()
    .getByRole("button", { name: "Añadir opción" })
    .click();
  const drawer = page.getByRole("dialog");
  // The Recetas tab shows the library as recipe cards; filter, then click the card.
  await drawer.getByPlaceholder("Buscar…").first().fill("E2E Snapshot");
  await drawer
    .getByTestId("picker-recipe")
    .filter({ hasText: RECIPE_NAME })
    .click();

  // The option chip shows the FROZEN kcal.
  await expect(page.getByTestId("option-kcal")).toHaveText(
    `${ORIGINAL_KCAL} kcal`
  );

  console.log("[e2e] step 5 — activate the cycle");
  await page.getByRole("button", { name: "Activar" }).click();
  await expect(page.getByText("Activo")).toBeVisible();

  console.log(
    `[e2e] step 6 — edit the recipe in the library (kcal ${ORIGINAL_KCAL} → ${EDITED_KCAL})`
  );
  const edit = await client
    .from("recipes")
    .update({ kcal: EDITED_KCAL })
    .eq("id", recipeId);

  expect(edit.error).toBeNull();

  console.log("[e2e] step 7 — the library now shows the EDITED macro");
  await page.goto("/trainer/dashboard/recipes");
  await expect(page.getByText(`${EDITED_KCAL} kcal`)).toBeVisible();

  console.log(
    "[e2e] step 8 — re-open the cycle: the option still shows the ORIGINAL frozen macro"
  );
  await page.goto(NUTRITION_PATH);
  await expect(page.getByTestId("option-kcal")).toHaveText(
    `${ORIGINAL_KCAL} kcal`
  );
  // The edited value never leaks into the frozen option.
  await expect(
    page.getByTestId("cycle-grid").getByText(`${EDITED_KCAL} kcal`)
  ).toHaveCount(0);

  console.log("[e2e] journey complete — snapshot did not move");
});
