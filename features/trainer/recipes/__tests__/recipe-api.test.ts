import type { FoodSearchResult, RecipeFormValues } from "../recipe-api";

import { describe, expect, it } from "vitest";

import {
  buildAddFromFoodPayload,
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
  it("freezes name + per-100g nutrients via the free-text path", () => {
    expect(buildAddFromFoodPayload({ food, quantity: 50 })).toEqual({
      name: "Rolled Oats",
      quantity: 50,
      unit: "g",
      nutrients_per_100g: { kcal: 389, protein_g: 16.9 },
    });
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
