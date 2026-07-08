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

  console.log("[e2e] step 2 — create a plan via the empty-state modal");
  await page.getByRole("button", { name: "Crear primer plan" }).click();
  await page.getByLabel("Nombre del plan").fill("E2E Ciclo");
  await page.getByLabel("Duración personalizada (días)").fill("3");
  await page.getByRole("button", { name: "Crear plan" }).click();
  await expect(page.getByRole("heading", { name: "E2E Ciclo" })).toBeVisible();

  console.log("[e2e] step 3 — add a Desayuno slot to day 1");
  await page.getByRole("button", { name: "Añadir comida" }).click();
  // The HeroUI menu re-renders while animating in, which makes a direct click
  // flaky ("element is not stable"); react-aria keyboard nav is deterministic —
  // ArrowDown focuses the first item (Desayuno), Enter picks it.
  await expect(page.getByRole("menu")).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(page.getByText("Desayuno").first()).toBeVisible();

  console.log("[e2e] step 4 — open the picker and add the recipe as an option");
  await page
    .getByRole("button", { name: "Añadir recetas o alimentos" })
    .first()
    .click();
  const drawer = page.getByRole("dialog");

  await drawer
    .getByPlaceholder("Buscar recetas publicadas...")
    .fill("E2E Snapshot");
  await drawer.getByText(RECIPE_NAME).first().click();
  // Step 2 of the picker (per-client portions) — confirm with the defaults.
  await drawer.getByRole("button", { name: "Añadir al plan" }).click();

  // The option row shows the FROZEN kcal.
  await expect(page.getByTestId("option-kcal")).toHaveText(
    `${ORIGINAL_KCAL} kcal`
  );

  console.log("[e2e] step 5 — activate the plan");
  await page.getByRole("button", { name: "Activar" }).click();
  // "Activo" shows in both the plan selector and the status chip.
  await expect(page.getByText("Activo").first()).toBeVisible();

  console.log(
    `[e2e] step 6 — edit the recipe in the library (kcal ${ORIGINAL_KCAL} → ${EDITED_KCAL})`
  );
  const edit = await client
    .from("recipes")
    .update({ kcal: EDITED_KCAL })
    .eq("id", recipeId);

  expect(edit.error).toBeNull();

  console.log(
    "[e2e] step 7 — the picker (library values) now shows the EDITED macro"
  );
  await page.goto(NUTRITION_PATH);
  await page
    .getByRole("button", { name: "Añadir recetas o alimentos a esta comida" })
    .click();
  const picker = page.getByRole("dialog");

  await picker
    .getByPlaceholder("Buscar recetas publicadas...")
    .fill("E2E Snapshot");
  await expect(picker.getByText(`${EDITED_KCAL} kcal`).first()).toBeVisible();
  await page.keyboard.press("Escape");

  console.log(
    "[e2e] step 8 — reload the plan: the option still shows the ORIGINAL frozen macro"
  );
  await page.goto(NUTRITION_PATH);
  await expect(page.getByTestId("option-kcal")).toHaveText(
    `${ORIGINAL_KCAL} kcal`
  );
  // The edited value never leaks into the frozen option.
  await expect(page.getByText(`${EDITED_KCAL} kcal`)).toHaveCount(0);

  console.log("[e2e] journey complete — snapshot did not move");
});
