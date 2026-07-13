import type { FoodSearchResult, RecipeFormValues } from "../recipe-api";

import { describe, expect, it } from "vitest";

import {
  buildAddFromFoodPayload,
  buildAddManualPayload,
  buildMediaFormData,
  buildRecipePayload,
  buildUpdateIngredientPayload,
} from "../recipe-api";

function makeValues(
  overrides: Partial<RecipeFormValues> = {}
): RecipeFormValues {
  return {
    name: "Soup",
    description: "",
    instructions: "",
    mealTypeTags: [],
    status: "draft",
    ...overrides,
  };
}

const food: FoodSearchResult = {
  source: "off",
  sourceRef: "off:1",
  name: "Rolled Oats",
  brand: "TestBrand",
  imageUrl: "https://img.test/oats.200.jpg",
  defaultUnit: "g",
  nutrientsPer100g: { kcal: 389, protein_g: 16.9 },
};

describe("buildRecipePayload", () => {
  it("trims name and includes tags + status; omits blank text", () => {
    const payload = buildRecipePayload(
      makeValues({
        name: "  Soup  ",
        mealTypeTags: ["lunch"],
        status: "active",
      })
    );

    expect(payload).toEqual({
      name: "Soup",
      meal_type_tags: ["lunch"],
      status: "active",
    });
  });

  it("includes trimmed description and instructions when present", () => {
    const payload = buildRecipePayload(
      makeValues({ description: "  d  ", instructions: "  do it  " })
    );

    expect(payload.description).toBe("d");
    expect(payload.instructions).toBe("do it");
  });
});

describe("buildAddFromFoodPayload", () => {
  it("freezes name + brand + image + per-100g nutrients via the free-text path", () => {
    expect(buildAddFromFoodPayload({ food, quantity: 50 })).toEqual({
      name: "Rolled Oats",
      brand: "TestBrand",
      image_url: "https://img.test/oats.200.jpg",
      quantity: 50,
      unit: "g",
      nutrients_per_100g: { kcal: 389, protein_g: 16.9 },
    });
  });

  it("omits brand and image_url when the food has neither", () => {
    const plain: FoodSearchResult = {
      source: "manual",
      sourceRef: null,
      name: "Agua",
      defaultUnit: "g",
      nutrientsPer100g: { kcal: 0 },
    };
    const payload = buildAddFromFoodPayload({ food: plain, quantity: 100 });

    expect("brand" in payload).toBe(false);
    expect("image_url" in payload).toBe(false);
  });

  it("links the line to its cache row when the food carries an id", () => {
    const cached: FoodSearchResult = { ...food, id: "cache-row-1" };
    const payload = buildAddFromFoodPayload({ food: cached, quantity: 50 });

    expect(payload.ingredient_id).toBe("cache-row-1");
    // A food without an id (not yet cached) sends none.
    expect(
      "ingredient_id" in buildAddFromFoodPayload({ food, quantity: 50 })
    ).toBe(false);
  });

  it("honors an explicit unit override", () => {
    const payload = buildAddFromFoodPayload({
      food,
      quantity: 2,
      unit: "unit",
    });

    expect(payload.unit).toBe("unit");
  });
});

describe("buildAddManualPayload", () => {
  it("trims name, forces unit g, and coerces the 8 nutrients", () => {
    const payload = buildAddManualPayload({
      name: "  Homemade sauce  ",
      quantity: 30,
      nutrients: {
        kcal: "120",
        protein_g: 4,
        carbs_g: "10.5",
        fat_g: 6,
        sugar_g: "2",
        fiber_g: 1,
        sat_fat_g: "1.2",
        sodium_mg: 300,
      },
    });

    expect(payload).toEqual({
      name: "Homemade sauce",
      quantity: 30,
      unit: "g",
      nutrients_per_100g: {
        kcal: 120,
        protein_g: 4,
        carbs_g: 10.5,
        fat_g: 6,
        sugar_g: 2,
        fiber_g: 1,
        sat_fat_g: 1.2,
        sodium_mg: 300,
      },
    });
  });

  it("defaults missing / NaN / garbage nutrients to 0", () => {
    const payload = buildAddManualPayload({
      name: "Water",
      quantity: 250,
      nutrients: { kcal: "abc", protein_g: NaN },
    });

    expect(payload.nutrients_per_100g).toEqual({
      kcal: 0,
      protein_g: 0,
      carbs_g: 0,
      fat_g: 0,
      sugar_g: 0,
      fiber_g: 0,
      sat_fat_g: 0,
      sodium_mg: 0,
    });
  });
});

describe("buildUpdateIngredientPayload", () => {
  it("includes only provided fields", () => {
    expect(buildUpdateIngredientPayload({ quantity: 120 })).toEqual({
      quantity: 120,
    });
    expect(buildUpdateIngredientPayload({})).toEqual({});
    expect(buildUpdateIngredientPayload({ quantity: 1, unit: "g" })).toEqual({
      quantity: 1,
      unit: "g",
    });
  });

  it("carries grams-per-unit, including an explicit null to clear it", () => {
    expect(
      buildUpdateIngredientPayload({ unit: "u", gramsPerUnit: 60 })
    ).toEqual({ unit: "u", grams_per_unit: 60 });
    expect(buildUpdateIngredientPayload({ gramsPerUnit: null })).toEqual({
      grams_per_unit: null,
    });
  });
});

describe("buildMediaFormData", () => {
  it("sets the file and optional orientation", () => {
    const file = new File([new Uint8Array([1])], "v.mp4", {
      type: "video/mp4",
    });

    const withOrientation = buildMediaFormData(file, "vertical");

    expect(withOrientation.get("file")).toBeInstanceOf(File);
    expect(withOrientation.get("orientation")).toBe("vertical");

    const withoutOrientation = buildMediaFormData(file);

    expect(withoutOrientation.get("orientation")).toBeNull();
  });
});
