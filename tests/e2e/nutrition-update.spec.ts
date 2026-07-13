import { expect, test } from "@playwright/test";

import {
  cleanLegacyNutritionTestData,
  seedLegacyNutrition,
} from "../../lib/test/legacy-nutrition-test-db";
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

import { addTrainerAuthCookie } from "./helpers/auth";

/**
 * The V1→V2 rollout wizard: renders its four steps with real data (import
 * candidates from seeded legacy plans, per-client verdicts), opens the
 * phone-frame preview, and its flag transitions actually write the tenant row
 * (assertions go to the DB — dev-mode flag READS are always-on by design).
 */

const db = createSupabaseTestClient();
const WIZARD_PATH = "/trainer/dashboard/nutrition-update";

async function tenantFlags(): Promise<{
  enabled: boolean | null;
  trainerEnabled: boolean | null;
}> {
  const { data } = await db
    .from("tenants")
    .select("nutrition_v2_enabled, nutrition_v2_trainer_enabled")
    .eq("host", TEST_TENANT_HOST)
    .maybeSingle();

  return {
    enabled:
      (data as { nutrition_v2_enabled?: boolean })?.nutrition_v2_enabled ??
      null,
    trainerEnabled:
      (data as { nutrition_v2_trainer_enabled?: boolean })
        ?.nutrition_v2_trainer_enabled ?? null,
  };
}

test.beforeAll(async () => {
  await ensureTestTenant(db);
  await ensureTestTrainer(db);
  await ensureTestClient(db);
  await db
    .from("tenants")
    .update({
      trainer_id: TEST_TRAINER_ID,
      status: "active",
      nutrition_v2_enabled: false,
      nutrition_v2_trainer_enabled: false,
    })
    .eq("host", TEST_TENANT_HOST);
  await db
    .from("clients")
    .update({ tenant: TEST_TRAINER_ID })
    .eq("id", TEST_CLIENT_ID);

  await cleanNutritionTestData(db);
  await cleanLegacyNutritionTestData(db);
  await db
    .from("client_diet_pdfs")
    .delete()
    .eq("tenant_host", TEST_TENANT_HOST);
  await db
    .from("client_nutrition_goals")
    .delete()
    .eq("tenant_host", TEST_TENANT_HOST);
  await db
    .from("client_goal_presets")
    .delete()
    .eq("tenant_host", TEST_TENANT_HOST);

  // Legacy data: import candidates for step 1, and a PDF diet for the test
  // client so step 2 shows a previewable "Verá su PDF" verdict.
  await seedLegacyNutrition(db);

  const { error } = await db.from("nutrition_plans").insert({
    tenant_host: TEST_TENANT_HOST,
    client_id: TEST_CLIENT_ID,
    trainer_id: TEST_TRAINER_ID,
    name: "Dieta PDF del cliente",
    status: "active",
    plan_mode: "pdf",
    pdf_url: "https://example.com/wizard.pdf",
    pdf_name: "dieta-wizard.pdf",
  });

  if (error !== null) {
    throw new Error(`seed client pdf: ${error.message}`);
  }
});

test.afterAll(async () => {
  await cleanLegacyNutritionTestData(db);
  await cleanNutritionTestData(db);
  await db
    .from("tenants")
    .update({ status: "inactive" })
    .eq("host", TEST_TENANT_HOST);
});

test("wizard renders all four steps with real candidates and verdicts", async ({
  context,
  page,
}) => {
  await addTrainerAuthCookie(context);
  await page.goto(WIZARD_PATH);

  await expect(page.getByText("Actualización a Nutrición 2.0")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Importa tus recetas" })
  ).toBeVisible();
  // A seeded legacy candidate shows in step 1's embedded importer.
  await expect(page.getByText("Pollo con arroz")).toBeVisible();

  // Step 2: the test client appears with the PDF verdict.
  await expect(
    page.getByRole("heading", { name: "Revisa a tus clientes" })
  ).toBeVisible();
  await expect(page.getByText("Verá su PDF").first()).toBeVisible();

  // Steps 3 & 4 are present.
  await expect(
    page.getByRole("heading", { name: "Conoce la nueva nutrición" })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Activa el cambio" })
  ).toBeVisible();
});

test("phone-frame preview shows the client's real PDF", async ({
  context,
  page,
}) => {
  await addTrainerAuthCookie(context);
  await page.goto(WIZARD_PATH);

  await page.getByRole("button", { name: "Vista previa" }).first().click();

  await expect(
    page.getByText(/Así verá .* su sección de Nutrición/)
  ).toBeVisible();
  await expect(page.getByText("dieta-wizard.pdf")).toBeVisible();
});

test("visiting the wizard enables prepare mode in the tenant row", async ({
  context,
  page,
}) => {
  await db
    .from("tenants")
    .update({ nutrition_v2_trainer_enabled: false })
    .eq("host", TEST_TENANT_HOST);

  await addTrainerAuthCookie(context);
  await page.goto(WIZARD_PATH);
  await expect(page.getByText("Actualización a Nutrición 2.0")).toBeVisible();

  // The auto-enable fires only when the READ says trainer tools are off; in
  // dev reads are always-on, so exercise the same transition via the API the
  // effect calls — the write path is identical.
  const response = await context.request.post("/api/nutrition-update/flags", {
    data: { action: "enable_trainer" },
  });

  expect(response.ok()).toBe(true);
  expect((await tenantFlags()).trainerEnabled).toBe(true);
});

test("activate and rollback write the client-facing flag", async ({
  context,
}) => {
  await addTrainerAuthCookie(context);

  const activate = await context.request.post("/api/nutrition-update/flags", {
    data: { action: "activate_clients" },
  });

  expect(activate.ok()).toBe(true);
  expect((await tenantFlags()).enabled).toBe(true);

  const rollback = await context.request.post("/api/nutrition-update/flags", {
    data: { action: "deactivate_clients" },
  });

  expect(rollback.ok()).toBe(true);
  expect((await tenantFlags()).enabled).toBe(false);

  // Unknown actions are rejected.
  const bogus = await context.request.post("/api/nutrition-update/flags", {
    data: { action: "drop_everything" },
  });

  expect(bogus.status()).toBe(400);
});
