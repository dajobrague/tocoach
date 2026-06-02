import type { FoodResult } from "../types";

import { describe, expect, it } from "vitest";

import { MockFoodSource } from "../mock-food-source";

const fixture: FoodResult = {
  source: "off",
  sourceRef: "off:3017620422003",
  name: "Hazelnut spread",
  brand: "Ferrero",
  defaultUnit: "g",
  nutrientsPer100g: {
    kcal: 539,
    protein_g: 6.3,
    carbs_g: 57.5,
    fat_g: 30.9,
    sugar_g: 56.3,
    fiber_g: 0,
    sat_fat_g: 10.6,
    sodium_mg: 41,
  },
};

describe("MockFoodSource", () => {
  it("returns the configured search results", async () => {
    const source = new MockFoodSource({ searchResults: [fixture] });
    const results = await source.search("hazelnut");

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual(fixture);
  });

  it("returns an empty array when no search results are configured", async () => {
    const source = new MockFoodSource();

    expect(await source.search("anything")).toEqual([]);
  });

  it("resolves getByRef from the configured ref map", async () => {
    const source = new MockFoodSource({
      byRef: { "off:3017620422003": fixture },
    });

    expect(await source.getByRef("off:3017620422003")).toEqual(fixture);
  });

  it("returns null from getByRef for an unknown ref", async () => {
    const source = new MockFoodSource();

    expect(await source.getByRef("does-not-exist")).toBeNull();
  });

  it("resolves getByBarcode from the configured barcode map", async () => {
    const source = new MockFoodSource({
      byBarcode: { "3017620422003": fixture },
    });

    expect(await source.getByBarcode("3017620422003")).toEqual(fixture);
  });

  it("returns null from getByBarcode for an unknown code", async () => {
    const source = new MockFoodSource();

    expect(await source.getByBarcode("000000000000")).toBeNull();
  });

  it("reflects results set after construction", async () => {
    const source = new MockFoodSource();

    source.setSearchResults([fixture]);
    source.setByRef("off:3017620422003", fixture);
    source.setByBarcode("3017620422003", fixture);

    expect(await source.search("hazelnut")).toEqual([fixture]);
    expect(await source.getByRef("off:3017620422003")).toEqual(fixture);
    expect(await source.getByBarcode("3017620422003")).toEqual(fixture);
  });
});
