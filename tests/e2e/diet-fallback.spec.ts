import { expect, test } from "@playwright/test";

import { ClientGoalsService } from "../../lib/nutrition/goals/client-goals-service";
import { GoalPresetsService } from "../../lib/nutrition/goals/goal-presets-service";
import {
  TEST_CLIENT_ID,
  TEST_TENANT_HOST,
  TEST_TRAINER_ID,
  cleanNutritionTestData,
  ensureTestClient,
  ensureTestTenant,
  ensureTestTrainer,
} from "../../lib/test/nutrition-test-db";
import { createSupabaseTestClient } from "../../lib/test/supabase-test-client";

import { addClientAuthCookie, TEST_TENANT_SLUG } from "./helpers/auth";

/**
 * Delivery-ladder fallbacks of the client Nutrición page (no active meal
 * plan): a legacy PDF diet renders the PDF view; goals/presets without a PDF
 * render the goals-only view. Mirrors the ~120 production clients who receive
 * their diet as a PDF today — the exact case that must survive the v2 flip.
 */

const db = createSupabaseTestClient();
const NUTRITION_PATH = `/${TEST_TENANT_SLUG}/nutricion`;
const PDF_NAME = "dieta-e2e.pdf";

test.beforeAll(async () => {
  await ensureTestTenant(db);
  await ensureTestTrainer(db);
  await ensureTestClient(db);
  await db
    .from("tenants")
    .update({ trainer_id: TEST_TRAINER_ID, status: "active" })
    .eq("host", TEST_TENANT_HOST);

  // No meal cycles for this client — the ladder must fall through.
  await cleanNutritionTestData(db);
});

test.afterAll(async () => {
  await db.from("nutrition_plans").delete().eq("tenant_host", TEST_TENANT_HOST);
  await db
    .from("tenants")
    .update({ status: "inactive" })
    .eq("host", TEST_TENANT_HOST);
});

test.beforeEach(async () => {
  await db.from("nutrition_plans").delete().eq("tenant_host", TEST_TENANT_HOST);
  await db
    .from("client_goal_presets")
    .delete()
    .eq("tenant_host", TEST_TENANT_HOST);
  await db
    .from("client_nutrition_goals")
    .delete()
    .eq("tenant_host", TEST_TENANT_HOST);
});

test("a legacy PDF diet renders the PDF view when no plan is active", async ({
  context,
  page,
}) => {
  const { error } = await db.from("nutrition_plans").insert({
    tenant_host: TEST_TENANT_HOST,
    client_id: TEST_CLIENT_ID,
    trainer_id: TEST_TRAINER_ID,
    name: "Dieta PDF legacy",
    status: "active",
    plan_mode: "pdf",
    pdf_url: "https://example.com/dieta-e2e.pdf",
    pdf_name: PDF_NAME,
  });

  expect(error).toBeNull();

  await addClientAuthCookie(context);
  await page.goto(NUTRITION_PATH);

  // The PDF card: filename, and both actions pointing at the file. HeroUI's
  // Button keeps role="button" even rendered as an <a>, so match by role
  // button and assert the anchor's href.
  await expect(page.getByText(PDF_NAME)).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Abrir PDF/i })
  ).toHaveAttribute("href", "https://example.com/dieta-e2e.pdf");
  await expect(page.getByRole("button", { name: /Descargar/i })).toBeVisible();
});

test("goals + presets render the goals-only view when there is no PDF", async ({
  context,
  page,
}) => {
  await new ClientGoalsService(db).upsert(TEST_TENANT_HOST, TEST_CLIENT_ID, {
    kcal: 2200,
    protein_g: 160,
    carbs_g: 220,
    fat_g: 70,
  });
  await new GoalPresetsService(db).create(TEST_TENANT_HOST, TEST_CLIENT_ID, {
    name: "Día de entrenamiento",
    kcal: 2800,
    protein_g: 180,
    carbs_g: 300,
    fat_g: 80,
  });

  await addClientAuthCookie(context);
  await page.goto(NUTRITION_PATH);

  await expect(page.getByText("Tus objetivos nutricionales")).toBeVisible();
  await expect(page.getByText("Objetivo diario")).toBeVisible();
  await expect(page.getByText("Día de entrenamiento")).toBeVisible();
  await expect(page.getByText("2800")).toBeVisible();
});

test("no plan, no PDF, no goals → the empty state", async ({
  context,
  page,
}) => {
  await addClientAuthCookie(context);
  await page.goto(NUTRITION_PATH);

  await expect(page.getByText("Sin plan activo")).toBeVisible();
});
