import type { RecipeListItem } from "../recipe-query";

import { describe, expect, it } from "vitest";

import { buildRecipesQuery, distinctMealTypes } from "../recipe-query";

function makeRecipe(overrides: Partial<RecipeListItem> = {}): RecipeListItem {
  return {
    id: "r1",
    name: "Recipe",
    status: "active",
    meal_type_tags: [],
    kcal: 0,
    protein_g: 0,
    carbs_g: 0,
    fat_g: 0,
    ...overrides,
  };
}

describe("buildRecipesQuery", () => {
  it("returns an empty string when no filters are set", () => {
    expect(buildRecipesQuery({})).toBe("");
  });

  it("maps query -> q, status -> status, mealType -> tag", () => {
    const qs = buildRecipesQuery({
      query: "oats",
      status: "active",
      mealType: "lunch",
    });

    expect(qs).toContain("q=oats");
    expect(qs).toContain("status=active");
    expect(qs).toContain("tag=lunch");
    expect(qs.startsWith("?")).toBe(true);
  });

  it("trims and omits blank query and mealType", () => {
    expect(buildRecipesQuery({ query: "   " })).toBe("");
    expect(buildRecipesQuery({ mealType: "  " })).toBe("");
    expect(buildRecipesQuery({ query: "  soup  " })).toBe("?q=soup");
  });

  it("url-encodes values", () => {
    expect(buildRecipesQuery({ query: "a b&c" })).toBe("?q=a+b%26c");
  });
});

describe("distinctMealTypes", () => {
  it("collects sorted distinct tags across recipes", () => {
    const recipes = [
      makeRecipe({ meal_type_tags: ["lunch", "dinner"] }),
      makeRecipe({ meal_type_tags: ["lunch", "snack"] }),
      makeRecipe({ meal_type_tags: [] }),
    ];

    expect(distinctMealTypes(recipes)).toEqual(["dinner", "lunch", "snack"]);
  });

  it("always includes the selected tag even if no recipe has it", () => {
    expect(distinctMealTypes([], "breakfast")).toEqual(["breakfast"]);
  });
});
