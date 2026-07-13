import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { getClientDietPdf } from "../diet-fallback";

import {
  TEST_TENANT_HOST,
  TEST_TRAINER_ID,
  ensureTestClient,
  ensureTestTenant,
  ensureTestTrainer,
} from "@/lib/test/nutrition-test-db";
import { createSupabaseTestClient } from "@/lib/test/supabase-test-client";

/**
 * Legacy-PDF rung of the client nutrition delivery ladder (see
 * lib/nutrition/diet-fallback.ts). Runs against the local stack; rows are
 * seeded straight into the legacy `nutrition_plans` table exactly as the
 * pre-v2 app wrote them.
 */

const db = createSupabaseTestClient();

let clientId: number;

interface LegacyPlanSeed {
  status?: string;
  is_template?: boolean | null;
  plan_mode?: string;
  pdf_url?: string | null;
  pdf_name?: string | null;
  updated_at?: string;
  client_id?: number;
  tenant_host?: string;
}

async function seedLegacyPlan(over: LegacyPlanSeed = {}): Promise<void> {
  const { error } = await db.from("nutrition_plans").insert({
    tenant_host: over.tenant_host ?? TEST_TENANT_HOST,
    client_id: over.client_id ?? clientId,
    trainer_id: TEST_TRAINER_ID,
    name: "Legacy plan",
    status: over.status ?? "active",
    is_template: over.is_template === undefined ? false : over.is_template,
    plan_mode: over.plan_mode ?? "pdf",
    pdf_url:
      over.pdf_url === undefined ? "https://cdn.test/diet.pdf" : over.pdf_url,
    pdf_name: over.pdf_name === undefined ? "dieta-julio.pdf" : over.pdf_name,
    ...(over.updated_at !== undefined ? { updated_at: over.updated_at } : {}),
  });

  if (error !== null) {
    throw new Error(`seedLegacyPlan failed: ${error.message}`);
  }
}

async function cleanLegacyPlans(): Promise<void> {
  const { error } = await db
    .from("nutrition_plans")
    .delete()
    .eq("tenant_host", TEST_TENANT_HOST);

  if (error !== null) {
    throw new Error(`cleanLegacyPlans failed: ${error.message}`);
  }
}

/** A second client of the same tenant, for the isolation case. */
const OTHER_CLIENT_ID = 999000077;

beforeAll(async () => {
  await ensureTestTenant(db);
  await ensureTestTrainer(db);
  clientId = await ensureTestClient(db);

  const { error } = await db.from("clients").upsert(
    {
      id: OTHER_CLIENT_ID,
      name: "Diet Fallback Other Client",
      email: "diet-fallback-other@test.local",
    },
    { onConflict: "id" }
  );

  if (error !== null) {
    throw new Error(`seed other client failed: ${error.message}`);
  }
});

beforeEach(cleanLegacyPlans);
afterAll(async () => {
  await cleanLegacyPlans();
  await db.from("clients").delete().eq("id", OTHER_CLIENT_ID);
});

describe("getClientDietPdf (legacy nutrition_plans fallback)", () => {
  it("returns null when the client has no plans at all", async () => {
    expect(await getClientDietPdf(db, TEST_TENANT_HOST, clientId)).toBeNull();
  });

  it("returns the active plan's PDF with its display name", async () => {
    await seedLegacyPlan();

    expect(await getClientDietPdf(db, TEST_TENANT_HOST, clientId)).toEqual({
      url: "https://cdn.test/diet.pdf",
      name: "dieta-julio.pdf",
    });
  });

  it("falls back to a default filename when pdf_name is empty/null", async () => {
    await seedLegacyPlan({ pdf_name: null });

    const result = await getClientDietPdf(db, TEST_TENANT_HOST, clientId);

    expect(result?.name).toBe("plan-nutricional.pdf");
  });

  it("ignores plans without a PDF, non-active plans, and templates", async () => {
    await seedLegacyPlan({ pdf_url: null, plan_mode: "structured" });
    await seedLegacyPlan({ status: "paused" });
    await seedLegacyPlan({ is_template: true });

    expect(await getClientDietPdf(db, TEST_TENANT_HOST, clientId)).toBeNull();
  });

  it("includes legacy rows where is_template is NULL", async () => {
    await seedLegacyPlan({ is_template: null });

    const result = await getClientDietPdf(db, TEST_TENANT_HOST, clientId);

    expect(result?.url).toBe("https://cdn.test/diet.pdf");
  });

  it("picks the most recently updated PDF when several are active", async () => {
    await seedLegacyPlan({
      pdf_url: "https://cdn.test/old.pdf",
      updated_at: "2026-01-01T00:00:00Z",
    });
    await seedLegacyPlan({
      pdf_url: "https://cdn.test/new.pdf",
      updated_at: "2026-07-01T00:00:00Z",
    });

    const result = await getClientDietPdf(db, TEST_TENANT_HOST, clientId);

    expect(result?.url).toBe("https://cdn.test/new.pdf");
  });

  it("never returns another client's PDF, nor anything for an unknown tenant", async () => {
    // A different client of the SAME tenant; cross-tenant rows cannot even
    // exist (nutrition_plans.tenant_host is an FK to tenants).
    await seedLegacyPlan({ client_id: OTHER_CLIENT_ID });

    expect(await getClientDietPdf(db, TEST_TENANT_HOST, clientId)).toBeNull();
    expect(
      await getClientDietPdf(db, "ghost-tenant.local", clientId)
    ).toBeNull();
  });

  it("counts hybrid plans (structured + PDF) as PDF-bearing", async () => {
    await seedLegacyPlan({ plan_mode: "hybrid" });

    const result = await getClientDietPdf(db, TEST_TENANT_HOST, clientId);

    expect(result).not.toBeNull();
  });
});
