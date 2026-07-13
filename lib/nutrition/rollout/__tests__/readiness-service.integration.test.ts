import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { listClientReadiness } from "../readiness-service";

import { upsertClientDietPdf } from "@/lib/nutrition/diet-fallback";
import { ClientGoalsService } from "@/lib/nutrition/goals/client-goals-service";
import { MealCycleService } from "@/lib/nutrition/cycles/meal-cycle-service";
import {
  TEST_TENANT_HOST,
  TEST_TRAINER_ID,
  cleanNutritionTestData,
  ensureTestClient,
  ensureTestTenant,
  ensureTestTrainer,
} from "@/lib/test/nutrition-test-db";
import { createSupabaseTestClient } from "@/lib/test/supabase-test-client";

/**
 * Per-client rollout readiness against the local DB: one client walked through
 * every rung (v2 plan → pdf → goals → at-risk structured V1 → none), plus a
 * second client proving verdicts never bleed across clients.
 */

const db = createSupabaseTestClient();
const OTHER_CLIENT_ID = 999000088;

let clientId: number;

async function cleanAll(): Promise<void> {
  await cleanNutritionTestData(db);
  await db.from("nutrition_plans").delete().eq("tenant_host", TEST_TENANT_HOST);
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
}

async function verdictOf(id: number): Promise<string | undefined> {
  const readiness = await listClientReadiness(
    db,
    TEST_TENANT_HOST,
    TEST_TRAINER_ID
  );

  return readiness.find((row) => row.clientId === id)?.verdict;
}

async function seedStructuredV1Plan(targetClientId: number): Promise<void> {
  const { error } = await db.from("nutrition_plans").insert({
    tenant_host: TEST_TENANT_HOST,
    client_id: targetClientId,
    trainer_id: TEST_TRAINER_ID,
    name: "Plan estructurado V1",
    status: "active",
    plan_mode: "structured",
  });

  if (error !== null) {
    throw new Error(`seedStructuredV1Plan: ${error.message}`);
  }
}

beforeAll(async () => {
  await ensureTestTenant(db);
  await ensureTestTrainer(db);
  clientId = await ensureTestClient(db);

  // Readiness lists clients by clients.tenant = trainer UUID.
  await db
    .from("clients")
    .update({ tenant: TEST_TRAINER_ID })
    .eq("id", clientId);
  const { error } = await db.from("clients").upsert(
    {
      id: OTHER_CLIENT_ID,
      name: "Readiness Other Client",
      email: "readiness-other@test.local",
      tenant: TEST_TRAINER_ID,
    },
    { onConflict: "id" }
  );

  if (error !== null) {
    throw new Error(`seed other client: ${error.message}`);
  }
});

beforeEach(cleanAll);
afterAll(async () => {
  await cleanAll();
  await db.from("clients").delete().eq("id", OTHER_CLIENT_ID);
});

describe("listClientReadiness (integration, local DB)", () => {
  it("resolves none / at_risk / goals / pdf per client, independently", async () => {
    // Client A: structured V1 plan only → at_risk. Client B: nothing → none.
    await seedStructuredV1Plan(clientId);

    expect(await verdictOf(clientId)).toBe("at_risk");
    expect(await verdictOf(OTHER_CLIENT_ID)).toBe("none");

    // Goals rescue the at-risk client.
    await new ClientGoalsService(db).upsert(TEST_TENANT_HOST, clientId, {
      kcal: 2000,
      protein_g: 150,
      carbs_g: 200,
      fat_g: 60,
    });
    expect(await verdictOf(clientId)).toBe("goals");

    // A v2 PDF beats goals; the readiness row carries it for the preview.
    await upsertClientDietPdf(db, TEST_TENANT_HOST, clientId, {
      url: "https://cdn.test/rollout.pdf",
      name: "rollout.pdf",
    });

    const withPdf = await listClientReadiness(
      db,
      TEST_TENANT_HOST,
      TEST_TRAINER_ID
    );
    const row = withPdf.find((r) => r.clientId === clientId);

    expect(row?.verdict).toBe("pdf");
    expect(row?.pdf?.name).toBe("rollout.pdf");
    // The other client never inherits any of it.
    expect(await verdictOf(OTHER_CLIENT_ID)).toBe("none");
  });

  it("a legacy PDF plan is 'pdf', not at_risk (hybrid counts as covered)", async () => {
    const { error } = await db.from("nutrition_plans").insert({
      tenant_host: TEST_TENANT_HOST,
      client_id: clientId,
      trainer_id: TEST_TRAINER_ID,
      name: "Dieta PDF legacy",
      status: "active",
      plan_mode: "pdf",
      pdf_url: "https://cdn.test/legacy.pdf",
      pdf_name: "legacy.pdf",
    });

    expect(error).toBeNull();
    expect(await verdictOf(clientId)).toBe("pdf");
  });

  it("an ACTIVE v2 meal plan wins over everything else", async () => {
    await seedStructuredV1Plan(clientId);

    const cycles = new MealCycleService(db);
    const cycle = await cycles.create(TEST_TENANT_HOST, {
      trainerId: TEST_TRAINER_ID,
      clientId,
      name: "Plan v2",
      durationDays: 3,
      status: "draft",
    });

    await cycles.update(TEST_TENANT_HOST, cycle.id, { status: "active" });

    expect(await verdictOf(clientId)).toBe("plan_v2");
  });
});
