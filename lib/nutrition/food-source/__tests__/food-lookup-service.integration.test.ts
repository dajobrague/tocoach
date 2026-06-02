import type { FoodResult } from "../types";

import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { FoodLookupService } from "../food-lookup-service";
import { SupabaseIngredientRepository } from "../ingredient-repository";
import { MockFoodSource } from "../mock-food-source";

import { createSupabaseTestClient } from "@/lib/test/supabase-test-client";
import {
  TEST_TENANT_HOST,
  cleanNutritionTestData,
  ensureTestTenant,
} from "@/lib/test/nutrition-test-db";

const client = createSupabaseTestClient();
const repo = new SupabaseIngredientRepository(client);

const offResult: FoodResult = {
  source: "off",
  sourceRef: "off:int-oats",
  name: "Rolled Oats",
  brand: "TestBrand",
  defaultUnit: "g",
  nutrientsPer100g: {
    kcal: 389,
    protein_g: 16.9,
    carbs_g: 66.3,
    fat_g: 6.9,
    sugar_g: 0,
    fiber_g: 10.6,
    sat_fat_g: 1.2,
    sodium_mg: 2,
  },
};

describe("FoodLookupService (integration, local DB)", () => {
  beforeAll(async () => {
    await ensureTestTenant(client);
    await cleanNutritionTestData(client);
  });

  afterEach(async () => {
    await cleanNutritionTestData(client);
  });

  afterAll(async () => {
    await cleanNutritionTestData(client);
  });

  it("serves a repeated search from cache (invariant §4.5)", async () => {
    const source = new MockFoodSource({ searchResults: [offResult] });
    const searchSpy = vi.spyOn(source, "search");
    const service = new FoodLookupService({ repo, source });

    const first = await service.search(TEST_TENANT_HOST, "oats");

    expect(first).toHaveLength(1);
    expect(first[0]?.name).toBe("Rolled Oats");

    const second = await service.search(TEST_TENANT_HOST, "oats");

    expect(second).toHaveLength(1);
    expect(second[0]?.name).toBe("Rolled Oats");
    expect(Number(second[0]?.nutrientsPer100g.kcal)).toBe(389);

    // The source was hit on the miss only; the second call was a cache hit.
    expect(searchSpy).toHaveBeenCalledTimes(1);

    const { data } = await client
      .from("ingredients")
      .select("id")
      .eq("tenant_host", TEST_TENANT_HOST);

    expect(data ?? []).toHaveLength(1);
  });

  it("createManual persists a source='manual' row", async () => {
    const source = new MockFoodSource();
    const service = new FoodLookupService({ repo, source });

    const result = await service.createManual(TEST_TENANT_HOST, {
      name: "Manual Chicken Breast",
      brand: "Homemade",
      nutrientsPer100g: {
        kcal: 165,
        protein_g: 31,
        carbs_g: 0,
        fat_g: 3.6,
        sugar_g: 0,
        fiber_g: 0,
        sat_fat_g: 1,
        sodium_mg: 74,
      },
    });

    expect(result.source).toBe("manual");
    expect(result.sourceRef).toBeNull();
    expect(result.name).toBe("Manual Chicken Breast");

    const { data, error } = await client
      .from("ingredients")
      .select("source, name")
      .eq("tenant_host", TEST_TENANT_HOST)
      .eq("source", "manual");

    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(1);
    expect(data?.[0]?.name).toBe("Manual Chicken Breast");
  });
});
