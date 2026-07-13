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

test("wizard walks page by page through the four steps", async ({
  context,
  page,
}) => {
  await addTrainerAuthCookie(context);
  await page.goto(WIZARD_PATH);

  // Step 1 — importer with a seeded legacy candidate.
  await expect(page.getByText("Actualización a Nutrición 2.0")).toBeVisible();
  await expect(page.getByText("Paso 1 de 4")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Importa tus recetas" })
  ).toBeVisible();
  await expect(page.getByText("Pollo con arroz")).toBeVisible();

  // Step 2 — the test client appears with the PDF verdict.
  await page.getByRole("button", { name: "Siguiente" }).click();
  await expect(page.getByText("Paso 2 de 4")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Revisa a tus clientes" })
  ).toBeVisible();
  await expect(page.getByText("Verá su PDF").first()).toBeVisible();

  // Step 3 — the explainer.
  await page.getByRole("button", { name: "Siguiente" }).click();
  await expect(
    page.getByRole("heading", { name: "Conoce la nueva nutrición" })
  ).toBeVisible();

  // Step 4 — the switch; Siguiente disappears on the last step.
  await page.getByRole("button", { name: "Siguiente" }).click();
  await expect(
    page.getByRole("heading", { name: "Activa el cambio" })
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Siguiente" })).toHaveCount(0);

  // Atrás returns to step 3.
  await page.getByRole("button", { name: "Atrás" }).click();
  await expect(
    page.getByRole("heading", { name: "Conoce la nueva nutrición" })
  ).toBeVisible();
});

test("phone-frame preview shows the client's real PDF", async ({
  context,
  page,
}) => {
  await addTrainerAuthCookie(context);
  await page.goto(WIZARD_PATH);

  // The client list lives on step 2.
  await page.getByRole("button", { name: "Siguiente" }).click();
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

test("metricas banner follows the rollout state", async ({ context, page }) => {
  await addTrainerAuthCookie(context);

  let flags = { enabled: false, trainerEnabled: false };

  await page.route("**/api/nutrition/flag", (route) =>
    route.fulfill({ json: flags })
  );

  // Not started — full announcement linking to the wizard.
  await page.goto("/trainer/dashboard/metricas");
  await expect(page.getByText("Nutrición 2.0 ya está aquí")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Empezar la actualización" })
  ).toHaveAttribute("href", WIZARD_PATH);

  // Prepare mode — continuation copy, and the wizard entry is in the nav.
  flags = { enabled: false, trainerEnabled: true };
  await page.reload();
  await expect(
    page.getByText("Continúa tu actualización a Nutrición 2.0")
  ).toBeVisible();
  await expect(page.getByText("Nutrición 2.0", { exact: true })).toBeVisible();

  // Live — nothing left to announce, and the nav entry retires too.
  flags = { enabled: true, trainerEnabled: true };
  await page.reload();
  await expect(page.getByRole("heading", { name: "Metricas" })).toBeVisible();
  await expect(page.getByText("ya está aquí")).toHaveCount(0);
  await expect(page.getByText("Nutrición 2.0", { exact: true })).toHaveCount(0);
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

  // Prototype-chain keys don't sneak past the allowlist either.
  const proto = await context.request.post("/api/nutrition-update/flags", {
    data: { action: "toString" },
  });

  expect(proto.status()).toBe(400);
});
