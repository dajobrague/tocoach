import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { LegacyNutritionScanService } from "../legacy-scan-service";

import {
  cleanLegacyNutritionTestData,
  seedLegacyNutrition,
  type SeededLegacyNutrition,
} from "@/lib/test/legacy-nutrition-test-db";
import {
  TEST_TENANT_HOST,
  ensureTestTenant,
  ensureTestTrainer,
} from "@/lib/test/nutrition-test-db";
import { createSupabaseTestClient } from "@/lib/test/supabase-test-client";

const OTHER_TENANT = "some-other-tenant.invalid";

const client = createSupabaseTestClient();
const service = new LegacyNutritionScanService(client);

describe("LegacyNutritionScanService (integration, local DB)", () => {
  let seeded: SeededLegacyNutrition;

  beforeAll(async () => {
    await ensureTestTenant(client);
    await ensureTestTrainer(client);
  });

  afterEach(async () => {
    await cleanLegacyNutritionTestData(client);
  });

  afterAll(async () => {
    await cleanLegacyNutritionTestData(client);

    const { data } = await client
      .from("nutrition_plans")
      .select("id")
      .eq("tenant_host", TEST_TENANT_HOST);

    expect(data ?? []).toHaveLength(0);
  });

  it("returns candidates for the tenant, skipping junk options", async () => {
    seeded = await seedLegacyNutrition(client);

    const candidates = await service.scan(TEST_TENANT_HOST);

    // Good + generic options become candidates; the empty option is skipped.
    expect(candidates).toHaveLength(2);

    const names = candidates.map((c) => c.name);

    expect(names).toContain(seeded.goodOptionName);
    expect(names).toContain(seeded.genericCandidateName);
    expect(
      candidates.some((c) => c.legacyOptionId === seeded.emptyOptionId)
    ).toBe(false);
  });

  it("maps ingredients, grams, derived per-100g nutrients and steps", async () => {
    seeded = await seedLegacyNutrition(client);

    const candidates = await service.scan(TEST_TENANT_HOST);
    const good = candidates.find(
      (c) => c.legacyOptionId === seeded.goodOptionId
    );

    expect(good).toBeDefined();
    expect(good?.ingredients).toEqual([
      { name: "Arroz", grams: 200 },
      // 150g contributing 45g protein / 9g carbs / 6g fat / 250 kcal -> per-100g.
      {
        name: "Pollo",
        grams: 150,
        nutrients: { protein_g: 30, carbs_g: 6, fat_g: 4, kcal: 166.6667 },
      },
    ]);
    expect(good?.steps).toBe(
      "Hervir el arroz y cocinar el pollo.\n\nServir caliente."
    );
    expect(good?.legacyTotals).toEqual({
      kcal: 1050,
      protein_g: 75,
      carbs_g: 160,
      fat_g: 12,
    });
  });

  it("is tenant-scoped — another tenant sees none of this data", async () => {
    seeded = await seedLegacyNutrition(client);

    const candidates = await service.scan(OTHER_TENANT);

    expect(candidates).toHaveLength(0);
  });
});
