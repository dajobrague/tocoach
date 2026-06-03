/**
 * Legacy-nutrition fixtures for importer integration tests.
 *
 * Seeds a minimal legacy `nutrition_*` tree (plan → day → meal → options →
 * ingredients) for the dedicated {@link TEST_TENANT_HOST}, and tears it down.
 *
 * Safety model: every write is scoped to the one fake test tenant + test
 * trainer. Cleanup deletes only `nutrition_plans` rows where
 * `tenant_host = TEST_TENANT_HOST`; days/meals/options/ingredients are removed
 * automatically via ON DELETE CASCADE. It can never touch a real tenant's
 * legacy data, and it never alters legacy table schema.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { TEST_TENANT_HOST, TEST_TRAINER_ID } from "./nutrition-test-db";
import { createSupabaseTestClient } from "./supabase-test-client";

/** Ids of the seeded legacy fixture, for targeted assertions. */
export interface SeededLegacyNutrition {
  planId: string;
  mealId: string;
  mealLabel: string;
  /** A well-named option with macro-bearing ingredients (-> a candidate). */
  goodOptionId: string;
  goodOptionName: string;
  /** A generic-named option with one ingredient (-> name-enriched candidate). */
  genericOptionId: string;
  genericCandidateName: string;
  /** An option with no ingredients (-> skipped as junk). */
  emptyOptionId: string;
}

async function insert(
  client: SupabaseClient,
  table: string,
  payload: Record<string, unknown>
): Promise<string> {
  const { data, error } = await client
    .from(table)
    .insert(payload)
    .select("id")
    .single();

  if (error !== null) {
    throw new Error(`seedLegacyNutrition: ${table} insert: ${error.message}`);
  }

  return (data as { id: string }).id;
}

/**
 * Seed one legacy plan/day/meal with three meal options for the test tenant.
 * Returns the ids so a test can assert against specific rows.
 */
export async function seedLegacyNutrition(
  client: SupabaseClient = createSupabaseTestClient()
): Promise<SeededLegacyNutrition> {
  const mealLabel = "Comida";
  const goodOptionName = "Pollo con arroz";

  const planId = await insert(client, "nutrition_plans", {
    tenant_host: TEST_TENANT_HOST,
    trainer_id: TEST_TRAINER_ID,
    name: "Legacy Import Test Plan",
  });
  const dayId = await insert(client, "nutrition_days", {
    nutrition_plan_id: planId,
    tenant_host: TEST_TENANT_HOST,
    day_label: "Día 1",
  });
  const mealId = await insert(client, "nutrition_meals", {
    nutrition_day_id: dayId,
    tenant_host: TEST_TENANT_HOST,
    label: mealLabel,
  });

  const goodOptionId = await insert(client, "nutrition_meal_options", {
    meal_id: mealId,
    name: goodOptionName,
    option_order: 1,
    instructions: "Hervir el arroz y cocinar el pollo.",
    recipe_notes: "Servir caliente.",
    protein: 75,
    carbs: 160,
    fats: 12,
    calories: 1050,
  });
  const emptyOptionId = await insert(client, "nutrition_meal_options", {
    meal_id: mealId,
    name: "Opción 2",
    option_order: 2,
  });
  const genericOptionId = await insert(client, "nutrition_meal_options", {
    meal_id: mealId,
    name: "Opción 3",
    option_order: 3,
  });

  // Good option: two lines, one carrying per-quantity macros.
  await insert(client, "nutrition_ingredients", {
    nutrition_meal_id: mealId,
    option_id: goodOptionId,
    tenant_host: TEST_TENANT_HOST,
    name: "Arroz",
    quantity: "200gr",
    unit: "",
    ingredient_order: 0,
  });
  await insert(client, "nutrition_ingredients", {
    nutrition_meal_id: mealId,
    option_id: goodOptionId,
    tenant_host: TEST_TENANT_HOST,
    name: "Pollo",
    quantity: "150gr",
    unit: "",
    ingredient_order: 1,
    protein: 45,
    carbs: 9,
    fats: 6,
    calories: 250,
  });

  // Generic-named option: one line -> candidate name enriched with meal label.
  await insert(client, "nutrition_ingredients", {
    nutrition_meal_id: mealId,
    option_id: genericOptionId,
    tenant_host: TEST_TENANT_HOST,
    name: "Aceite de oliva",
    quantity: "15ml",
    unit: "",
    ingredient_order: 0,
  });

  return {
    planId,
    mealId,
    mealLabel,
    goodOptionId,
    goodOptionName,
    genericOptionId,
    genericCandidateName: `${mealLabel} — Opción 3`,
    emptyOptionId,
  };
}

/**
 * Delete all legacy fixture data for the test tenant. Deletes only
 * `nutrition_plans` for TEST_TENANT_HOST — child rows cascade.
 */
export async function cleanLegacyNutritionTestData(
  client: SupabaseClient = createSupabaseTestClient()
): Promise<void> {
  const { error } = await client
    .from("nutrition_plans")
    .delete()
    .eq("tenant_host", TEST_TENANT_HOST);

  if (error !== null) {
    throw new Error(`cleanLegacyNutritionTestData failed: ${error.message}`);
  }
}
