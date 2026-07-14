import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  TEST_TENANT_HOST,
  cleanNutritionTestData,
  ensureTestTenant,
} from "@/lib/test/nutrition-test-db";
import { createSupabaseTestClient } from "@/lib/test/supabase-test-client";

const client = createSupabaseTestClient();

const sampleIngredient = {
  tenant_host: TEST_TENANT_HOST,
  source: "off",
  source_ref: "off:integration-001",
  name: "Test Rolled Oats",
  brand: "TestBrand",
  default_unit: "g",
  kcal: 389,
  protein_g: 16.9,
  carbs_g: 66.3,
  fat_g: 6.9,
  sugar_g: 0,
  fiber_g: 10.6,
  sat_fat_g: 1.2,
  sodium_mg: 2,
};

describe("ingredients table (integration, local DB)", () => {
  beforeAll(async () => {
    await ensureTestTenant(client);
    await cleanNutritionTestData(client);
  });

  afterEach(async () => {
    await cleanNutritionTestData(client);
  });

  afterAll(async () => {
    await cleanNutritionTestData(client);

    const { data, error } = await client
      .from("ingredients")
      .select("id")
      .eq("tenant_host", TEST_TENANT_HOST);

    expect(error).toBeNull();
    expect(data ?? []).toEqual([]);
  });

  it("round-trips an ingredient row under the test tenant", async () => {
    const insert = await client
      .from("ingredients")
      .insert(sampleIngredient)
      .select()
      .single();

    expect(insert.error).toBeNull();

    const { data, error } = await client
      .from("ingredients")
      .select("*")
      .eq("tenant_host", TEST_TENANT_HOST)
      .eq("source_ref", "off:integration-001")
      .single();

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data?.source).toBe("off");
    expect(data?.name).toBe("Test Rolled Oats");
    expect(data?.brand).toBe("TestBrand");
    expect(data?.default_unit).toBe("g");
    // numeric columns come back as strings from PostgREST → coerce to compare.
    expect(Number(data?.kcal)).toBe(389);
    expect(Number(data?.protein_g)).toBe(16.9);
    expect(Number(data?.carbs_g)).toBe(66.3);
    expect(Number(data?.fiber_g)).toBe(10.6);
    expect(Number(data?.sodium_mg)).toBe(2);
  });

  it("cleanNutritionTestData empties the table for the test tenant", async () => {
    await client.from("ingredients").insert(sampleIngredient);

    await cleanNutritionTestData(client);

    const { data, error } = await client
      .from("ingredients")
      .select("id")
      .eq("tenant_host", TEST_TENANT_HOST);

    expect(error).toBeNull();
    expect(data ?? []).toEqual([]);
  });
});
