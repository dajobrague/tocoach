import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { duplicateRecipe } from "../recipe-duplicate";
import { RecipeService } from "../recipe-service";

import {
  TEST_TENANT_HOST,
  TEST_TRAINER_ID,
  cleanNutritionTestData,
  ensureTestTenant,
  ensureTestTrainer,
} from "@/lib/test/nutrition-test-db";
import { createSupabaseTestClient } from "@/lib/test/supabase-test-client";

const client = createSupabaseTestClient();

describe("duplicateRecipe (integration, local DB)", () => {
  beforeAll(async () => {
    await ensureTestTenant(client);
    await ensureTestTrainer(client);
  });

  afterEach(async () => {
    await cleanNutritionTestData(client);
  });

  afterAll(async () => {
    await cleanNutritionTestData(client);
  });

  it("copies the recipe, its ingredients and media; other tenants get null", async () => {
    const source = await new RecipeService(client).create(
      TEST_TENANT_HOST,
      TEST_TRAINER_ID,
      { name: "Tortitas", mealTypeTags: ["desayuno"], status: "active" }
    );

    await client
      .from("recipes")
      .update({ kcal: 420, protein_g: 30 })
      .eq("id", source.id);
    await client.from("recipe_ingredients").insert([
      {
        recipe_id: source.id,
        ingredient_id: null,
        name_snapshot: "Avena",
        quantity: 50,
        unit: "g",
        nutrient_snapshot: { kcal: 380 },
        sort_order: 0,
      },
      {
        recipe_id: source.id,
        ingredient_id: null,
        name_snapshot: "Huevo",
        quantity: 2,
        unit: "u",
        grams_per_unit: 60,
        nutrient_snapshot: { kcal: 140 },
        sort_order: 1,
      },
    ]);
    // URL externa (no del bucket): se comparte tal cual, sin copia en storage.
    await client.from("recipe_media").insert({
      recipe_id: source.id,
      type: "image",
      url: "https://example.com/tortitas.jpg",
      sort_order: 0,
    });

    const copy = await duplicateRecipe(
      client,
      TEST_TENANT_HOST,
      TEST_TRAINER_ID,
      source.id
    );

    expect(copy).not.toBeNull();
    expect(copy?.id).not.toBe(source.id);
    expect(copy?.name).toBe("Tortitas (copia)");
    expect(copy?.status).toBe("active");
    expect(copy?.meal_type_tags).toEqual(["desayuno"]);
    expect(Number(copy?.kcal)).toBe(420);

    const { data: lines } = await client
      .from("recipe_ingredients")
      .select("name_snapshot, quantity, unit, grams_per_unit, sort_order")
      .eq("recipe_id", copy?.id ?? "")
      .order("sort_order");

    expect(
      lines?.map((l) => [l.name_snapshot, Number(l.quantity), l.unit])
    ).toEqual([
      ["Avena", 50, "g"],
      ["Huevo", 2, "u"],
    ]);

    const { data: media } = await client
      .from("recipe_media")
      .select("url")
      .eq("recipe_id", copy?.id ?? "");

    expect(media?.map((m) => m.url)).toEqual([
      "https://example.com/tortitas.jpg",
    ]);

    // El original no cambia.
    const { count } = await client
      .from("recipe_ingredients")
      .select("*", { count: "exact", head: true })
      .eq("recipe_id", source.id);

    expect(count).toBe(2);

    expect(
      await duplicateRecipe(
        client,
        "some-other-tenant.invalid",
        TEST_TRAINER_ID,
        source.id
      )
    ).toBeNull();
  });
});
