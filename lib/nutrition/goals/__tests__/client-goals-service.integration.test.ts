import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  ClientGoalsService,
  ClientGoalsValidationError,
} from "../client-goals-service";

import {
  TEST_CLIENT_ID,
  TEST_TENANT_HOST,
  ensureTestClient,
  ensureTestTenant,
  ensureTestTrainer,
  removeTestClient,
} from "@/lib/test/nutrition-test-db";
import { createSupabaseTestClient } from "@/lib/test/supabase-test-client";

const OTHER_TENANT = "some-other-tenant.invalid";

const client = createSupabaseTestClient();
const goals = new ClientGoalsService(client);

async function clearGoals(): Promise<void> {
  await client
    .from("client_nutrition_goals")
    .delete()
    .eq("client_id", TEST_CLIENT_ID);
}

describe("ClientGoalsService (integration, local DB)", () => {
  beforeAll(async () => {
    await ensureTestTenant(client);
    await ensureTestTrainer(client);
    await ensureTestClient(client);
  });

  afterEach(clearGoals);

  afterAll(async () => {
    await clearGoals();
    await removeTestClient(client);
  });

  it("returns null when a client has no saved goals", async () => {
    expect(await goals.get(TEST_TENANT_HOST, TEST_CLIENT_ID)).toBeNull();
  });

  it("upserts then reads back the client's goals", async () => {
    const saved = await goals.upsert(TEST_TENANT_HOST, TEST_CLIENT_ID, {
      kcal: 2200,
      protein_g: 180,
      carbs_g: 210,
      fat_g: 70,
    });

    expect(saved).toEqual({
      kcal: 2200,
      protein_g: 180,
      carbs_g: 210,
      fat_g: 70,
    });
    expect(await goals.get(TEST_TENANT_HOST, TEST_CLIENT_ID)).toEqual(saved);
  });

  it("replaces existing goals on a second upsert (one row per client)", async () => {
    await goals.upsert(TEST_TENANT_HOST, TEST_CLIENT_ID, {
      kcal: 2000,
      protein_g: 160,
      carbs_g: 200,
      fat_g: 60,
    });
    const updated = await goals.upsert(TEST_TENANT_HOST, TEST_CLIENT_ID, {
      kcal: 1800,
      protein_g: 150,
      carbs_g: 170,
      fat_g: 55,
    });

    expect(updated.kcal).toBe(1800);
    expect(await goals.get(TEST_TENANT_HOST, TEST_CLIENT_ID)).toEqual(updated);
  });

  it("rejects invalid values (non-integer, negative, zero kcal)", async () => {
    await expect(
      goals.upsert(TEST_TENANT_HOST, TEST_CLIENT_ID, {
        kcal: 0,
        protein_g: 160,
        carbs_g: 200,
        fat_g: 60,
      })
    ).rejects.toBeInstanceOf(ClientGoalsValidationError);
    await expect(
      goals.upsert(TEST_TENANT_HOST, TEST_CLIENT_ID, {
        kcal: 2000,
        protein_g: -1,
        carbs_g: 200,
        fat_g: 60,
      })
    ).rejects.toBeInstanceOf(ClientGoalsValidationError);
  });

  it("is tenant-scoped — another tenant cannot read the goals", async () => {
    await goals.upsert(TEST_TENANT_HOST, TEST_CLIENT_ID, {
      kcal: 2100,
      protein_g: 170,
      carbs_g: 205,
      fat_g: 65,
    });

    expect(await goals.get(OTHER_TENANT, TEST_CLIENT_ID)).toBeNull();
  });
});
