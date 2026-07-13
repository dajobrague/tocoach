import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { RecipeImportService } from "../import-service";

import { RecipeService } from "@/lib/nutrition/recipes/recipe-service";
import {
  cleanLegacyNutritionTestData,
  seedLegacyNutrition,
  type SeededLegacyNutrition,
} from "@/lib/test/legacy-nutrition-test-db";
import {
  TEST_TENANT_HOST,
  TEST_TRAINER_ID,
  cleanNutritionTestData,
  ensureTestTenant,
  ensureTestTrainer,
} from "@/lib/test/nutrition-test-db";
import { createSupabaseTestClient } from "@/lib/test/supabase-test-client";

const OTHER_TENANT = "some-other-tenant.invalid";

const client = createSupabaseTestClient();
const service = new RecipeImportService(client);
const recipes = new RecipeService(client);

async function ingredientRows(recipeId: string) {
  const { data } = await client
    .from("recipe_ingredients")
    .select("name_snapshot, quantity, unit, nutrient_snapshot, sort_order")
    .eq("recipe_id", recipeId)
    .order("sort_order", { ascending: true });

  return data ?? [];
}

describe("RecipeImportService (integration, local DB)", () => {
  let seeded: SeededLegacyNutrition;

  beforeAll(async () => {
    await ensureTestTenant(client);
    await ensureTestTrainer(client);
  });

  afterEach(async () => {
    await cleanNutritionTestData(client);
    await cleanLegacyNutritionTestData(client);
  });

  afterAll(async () => {
    await cleanNutritionTestData(client);
    await cleanLegacyNutritionTestData(client);
  });

  it("preview returns the tenant's review-ready candidates", async () => {
    seeded = await seedLegacyNutrition(client);

    const candidates = await service.preview(TEST_TENANT_HOST);

    expect(candidates.map((c) => c.legacyOptionId).sort()).toEqual(
      [
        seeded.goodOptionId,
        seeded.genericOptionId,
        seeded.prodOptionId,
        seeded.statedEmptyOptionId,
      ].sort()
    );
  });

  it("approve creates library recipes (with ingredients + totals) that the library lists", async () => {
    seeded = await seedLegacyNutrition(client);

    const result = await service.approve(TEST_TENANT_HOST, TEST_TRAINER_ID, [
      seeded.goodOptionId,
      seeded.genericOptionId,
    ]);

    expect(result.created).toHaveLength(2);
    expect(result.skipped).toHaveLength(0);

    // Both new recipes appear in the trainer's library.
    const library = await recipes.list(TEST_TENANT_HOST, {});
    const names = library.map((r) => r.name);

    expect(names).toContain(seeded.goodOptionName);
    expect(names).toContain(seeded.genericCandidateName);

    const good = result.created.find(
      (c) => c.legacyOptionId === seeded.goodOptionId
    );

    expect(good).toBeDefined();

    // Ingredient lines were added via the existing add path.
    const lines = await ingredientRows(good!.recipeId);

    expect(lines.map((l) => l.name_snapshot)).toEqual(["Arroz", "Pollo"]);
    expect(Number(lines[0]?.quantity)).toBe(200);

    // Recipe totals recomputed from the manual-entry snapshots
    // (Pollo: 166.6667 kcal/100g * 150g ≈ 250 kcal, 30 g/100g protein * 1.5 = 45).
    const row = await recipes.getById(TEST_TENANT_HOST, good!.recipeId);

    expect(row?.protein_g).toBe(45);
    expect(row?.kcal ?? 0).toBeCloseTo(250, 1);
  });

  it("imports ingredients with no usable macros as empty-snapshot manual lines", async () => {
    seeded = await seedLegacyNutrition(client);

    const result = await service.approve(TEST_TENANT_HOST, TEST_TRAINER_ID, [
      seeded.genericOptionId,
    ]);
    const created = result.created[0];

    expect(created).toBeDefined();

    const lines = await ingredientRows(created!.recipeId);

    expect(lines).toHaveLength(1);
    expect(lines[0]?.name_snapshot).toBe("Aceite de oliva");
    expect(Number(lines[0]?.quantity)).toBe(15);
    expect(lines[0]?.nutrient_snapshot).toEqual({});
  });

  it("PRODUCTION shape: option-level macros only → recipe totals equal the stated totals exactly", async () => {
    seeded = await seedLegacyNutrition(client);

    const result = await service.approve(TEST_TENANT_HOST, TEST_TRAINER_ID, [
      seeded.prodOptionId,
    ]);
    const created = result.created[0];

    expect(created).toBeDefined();

    const lines = await ingredientRows(created!.recipeId);

    expect(lines.map((l) => l.name_snapshot)).toEqual([
      "Pan integral",
      "Huevo",
      "Sal",
    ]);
    // "1 Unidad" lands as a real piece line with the 100 g convention.
    expect(lines[1]?.unit).toBe("u");
    expect(Number(lines[1]?.quantity)).toBe(1);
    // "al gusto" keeps the line, weighs nothing.
    expect(Number(lines[2]?.quantity)).toBe(0);

    // THE invariant: computed totals == what the old plan stated (500 kcal,
    // 30P / 40C / 20G) — this is exactly what was broken before (always 0).
    const recipe = await recipes.getById(TEST_TENANT_HOST, created!.recipeId);

    expect(Number(recipe?.kcal)).toBeCloseTo(500, 1);
    expect(Number(recipe?.protein_g)).toBeCloseTo(30, 1);
    expect(Number(recipe?.carbs_g)).toBeCloseTo(40, 1);
    expect(Number(recipe?.fat_g)).toBeCloseTo(20, 1);
  });

  it("imports a stated-macros option with no ingredient rows as a whole-dish recipe", async () => {
    seeded = await seedLegacyNutrition(client);

    const result = await service.approve(TEST_TENANT_HOST, TEST_TRAINER_ID, [
      seeded.statedEmptyOptionId,
    ]);
    const created = result.created[0];

    expect(created).toBeDefined();
    expect(created?.name).toBe(seeded.statedEmptyOptionName);

    const lines = await ingredientRows(created!.recipeId);

    expect(lines).toHaveLength(1);
    expect(lines[0]?.unit).toBe("u");

    const recipe = await recipes.getById(TEST_TENANT_HOST, created!.recipeId);

    expect(Number(recipe?.kcal)).toBeCloseTo(300, 1);
    expect(Number(recipe?.protein_g)).toBeCloseTo(25, 1);
  });

  it("preview marks already-imported candidates so the mark survives revisits", async () => {
    seeded = await seedLegacyNutrition(client);

    await service.approve(TEST_TENANT_HOST, TEST_TRAINER_ID, [
      seeded.goodOptionId,
    ]);

    const candidates = await service.preview(TEST_TENANT_HOST);
    const good = candidates.find(
      (c) => c.legacyOptionId === seeded.goodOptionId
    );
    const untouched = candidates.find(
      (c) => c.legacyOptionId === seeded.prodOptionId
    );

    expect(good?.alreadyImported).toBe(true);
    expect(untouched?.alreadyImported).toBeUndefined();
  });

  it("is idempotent — re-approving the same options skips duplicates", async () => {
    seeded = await seedLegacyNutrition(client);

    const first = await service.approve(TEST_TENANT_HOST, TEST_TRAINER_ID, [
      seeded.goodOptionId,
    ]);

    expect(first.created).toHaveLength(1);

    const second = await service.approve(TEST_TENANT_HOST, TEST_TRAINER_ID, [
      seeded.goodOptionId,
    ]);

    expect(second.created).toHaveLength(0);
    expect(second.skipped).toEqual([
      {
        legacyOptionId: seeded.goodOptionId,
        name: seeded.goodOptionName,
        reason: "duplicate",
      },
    ]);

    // Only one recipe with that name exists.
    const library = await recipes.list(TEST_TENANT_HOST, {});

    expect(
      library.filter((r) => r.name === seeded.goodOptionName)
    ).toHaveLength(1);
  });

  it("is tenant-scoped — another tenant cannot preview or approve this data", async () => {
    seeded = await seedLegacyNutrition(client);

    // Another tenant previews nothing.
    expect(await service.preview(OTHER_TENANT)).toHaveLength(0);

    // Approving this tenant's option ids from another tenant imports nothing.
    const result = await service.approve(OTHER_TENANT, TEST_TRAINER_ID, [
      seeded.goodOptionId,
    ]);

    expect(result.created).toHaveLength(0);
    expect(result.skipped[0]?.reason).toBe("not_found");

    // Nothing was created under either tenant.
    expect(await recipes.list(TEST_TENANT_HOST, {})).toHaveLength(0);
    expect(await recipes.list(OTHER_TENANT, {})).toHaveLength(0);
  });
});
