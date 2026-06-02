import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { isNutritionV2Enabled } from "@/lib/nutrition/feature-flag";
import {
  TEST_TENANT_HOST,
  ensureTestTenant,
} from "@/lib/test/nutrition-test-db";
import { createSupabaseTestClient } from "@/lib/test/supabase-test-client";

const client = createSupabaseTestClient();

async function setFlag(value: boolean): Promise<void> {
  const { error } = await client
    .from("tenants")
    .update({ nutrition_v2_enabled: value })
    .eq("host", TEST_TENANT_HOST);

  if (error !== null) {
    throw new Error(`failed to set flag: ${error.message}`);
  }
}

describe("isNutritionV2Enabled (integration, local DB)", () => {
  beforeAll(async () => {
    await ensureTestTenant(client);
  });

  afterAll(async () => {
    // The flag column is intentionally NOT in the cleanup allowlist, so reset
    // it explicitly to keep the test tenant default-off for the next run.
    await setFlag(false);
  });

  it("defaults to false", async () => {
    expect(await isNutritionV2Enabled(TEST_TENANT_HOST, client)).toBe(false);
  });

  it("returns true once the tenant's flag is enabled", async () => {
    await setFlag(true);

    expect(await isNutritionV2Enabled(TEST_TENANT_HOST, client)).toBe(true);
  });

  it("returns false for an unknown tenant", async () => {
    expect(await isNutritionV2Enabled("does-not-exist.invalid", client)).toBe(
      false
    );
  });
});
