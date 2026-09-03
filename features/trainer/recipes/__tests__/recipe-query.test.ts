import type { RecipeListItem } from "../recipe-query";

import { describe, expect, it } from "vitest";

import {
  buildRecipesQuery,
  distinctMealTypes,
  tagSuggestions,
} from "../recipe-query";

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

  it("maps query -> q, status -> status, each tag -> a repeated tag", () => {
    const qs = buildRecipesQuery({
      query: "oats",
      status: "active",
      tags: ["lunch", "vegan"],
    });

    expect(qs).toContain("q=oats");
    expect(qs).toContain("status=active");
    expect(qs).toContain("tag=lunch&tag=vegan");
    expect(qs.startsWith("?")).toBe(true);
  });

  it("trims and omits blank query and tags", () => {
    expect(buildRecipesQuery({ query: "   " })).toBe("");
    expect(buildRecipesQuery({ tags: ["  "] })).toBe("");
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

  it("always includes the selected tags even if no recipe has them", () => {
    expect(distinctMealTypes([], ["breakfast"])).toEqual(["breakfast"]);
  });
});

describe("tagSuggestions", () => {
  const existing = ["Desayunos", "sin gluten", "sin lactosa", "vegano"];

  it("an empty folder already canonizes its tag: suggest it, never create", () => {
    // Folder "Cenas" exists, no recipe carries the tag yet.
    const suggestions = distinctMealTypes([], ["Cenas"]);

    expect(tagSuggestions(suggestions, [], "cenas")).toEqual({
      matches: ["Cenas"],
      create: null,
    });
  });

  it("matches existing tags containing the text, minus selected ones", () => {
    expect(tagSuggestions(existing, ["sin gluten"], "SIN")).toEqual({
      matches: ["sin lactosa"],
      create: "SIN",
    });
  });

  it("offers creation only when no existing tag equals the text", () => {
    expect(tagSuggestions(existing, [], "Vegano").create).toBeNull();
    expect(tagSuggestions(existing, [], "   ").create).toBeNull();
    expect(tagSuggestions(existing, [], " veg ")).toEqual({
      matches: ["vegano"],
      create: "veg",
    });
  });
});
