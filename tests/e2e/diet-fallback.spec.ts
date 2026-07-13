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

import {
  addClientAuthCookie,
  addTrainerAuthCookie,
  TEST_TENANT_SLUG,
} from "./helpers/auth";

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
    .from("client_diet_pdfs")
    .delete()
    .eq("tenant_host", TEST_TENANT_HOST);
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

test("trainer uploads a v2 PDF via the API and the client sees it; deleting falls back to legacy", async ({
  browser,
}) => {
  // Legacy PDF in place — the upload must shadow it, and the delete reveal it.
  const { error } = await db.from("nutrition_plans").insert({
    tenant_host: TEST_TENANT_HOST,
    client_id: TEST_CLIENT_ID,
    trainer_id: TEST_TRAINER_ID,
    name: "Dieta PDF legacy",
    status: "active",
    plan_mode: "pdf",
    pdf_url: "https://example.com/legacy.pdf",
    pdf_name: "legacy.pdf",
  });

  expect(error).toBeNull();

  // Trainer context: upload through the real multipart endpoint.
  const trainerContext = await browser.newContext();

  await addTrainerAuthCookie(trainerContext);

  // A tiny but structurally valid-enough PDF payload (server checks MIME).
  const pdfBytes = Buffer.from(
    "%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF"
  );
  const upload = await trainerContext.request.post("/api/diet-pdf", {
    multipart: {
      clientId: String(TEST_CLIENT_ID),
      pdf: {
        name: "dieta-subida-v2.pdf",
        mimeType: "application/pdf",
        buffer: pdfBytes,
      },
    },
  });

  expect(upload.ok()).toBe(true);
  const uploaded = (await upload.json()) as {
    data: { url: string; name: string; source: string };
  };

  expect(uploaded.data.source).toBe("v2");
  expect(uploaded.data.name).toBe("dieta-subida-v2.pdf");

  // Client context: the v2 PDF shadows the legacy one.
  const clientContext = await browser.newContext();

  await addClientAuthCookie(clientContext);
  const clientPage = await clientContext.newPage();

  await clientPage.goto(NUTRITION_PATH);
  await expect(clientPage.getByText("dieta-subida-v2.pdf")).toBeVisible();

  // Trainer GET reflects the v2 source; DELETE removes it.
  const current = await trainerContext.request.get(
    `/api/diet-pdf?clientId=${TEST_CLIENT_ID}`
  );
  const currentBody = (await current.json()) as {
    data: { source: string } | null;
  };

  expect(currentBody.data?.source).toBe("v2");

  const del = await trainerContext.request.delete(
    `/api/diet-pdf?clientId=${TEST_CLIENT_ID}`
  );

  expect(del.ok()).toBe(true);

  // The ladder falls back to the legacy pointer.
  await clientPage.reload();
  await expect(clientPage.getByText("legacy.pdf")).toBeVisible();

  await trainerContext.close();
  await clientContext.close();
});
