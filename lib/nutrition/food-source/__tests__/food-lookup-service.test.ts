import type {
  IngredientRepository,
  IngredientRow,
} from "../ingredient-repository";
import type { FoodResult } from "../types";

import { describe, expect, it, vi } from "vitest";

import { FoodLookupService } from "../food-lookup-service";
import { rowToFoodResult } from "../ingredient-repository";
import { MockFoodSource } from "../mock-food-source";

const TENANT = "nutrition-v2-test.local";

function makeRow(overrides: Partial<IngredientRow> = {}): IngredientRow {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    tenant_host: TENANT,
    source: "off",
    source_ref: "off:cached-1",
    name: "Cached Oats",
    brand: "CachedBrand",
    default_unit: "g",
    kcal: 389,
    protein_g: 16.9,
    carbs_g: 66.3,
    fat_g: 6.9,
    sugar_g: 0,
    fiber_g: 10.6,
    sat_fat_g: 1.2,
    sodium_mg: 2,
    nutrient_extra: {},
    created_by: null,
    created_at: "2026-06-02T00:00:00Z",
    updated_at: "2026-06-02T00:00:00Z",
    ...overrides,
  };
}

function makeResult(overrides: Partial<FoodResult> = {}): FoodResult {
  return {
    source: "off",
    sourceRef: "off:source-1",
    name: "Source Oats",
    brand: "SourceBrand",
    defaultUnit: "g",
    nutrientsPer100g: {
      kcal: 100,
      protein_g: 1,
      carbs_g: 2,
      fat_g: 3,
      sugar_g: 4,
      fiber_g: 5,
      sat_fat_g: 6,
      sodium_mg: 7,
    },
    ...overrides,
  };
}

function makeRepo(
  overrides: Partial<IngredientRepository> = {}
): IngredientRepository {
  return {
    findCachedByQuery: vi.fn(async () => []),
    findCachedByRef: vi.fn(async () => null),
    insertResolved: vi.fn(async () => {}),
    insertManual: vi.fn(async () => makeRow({ source: "manual" })),
    ...overrides,
  };
}

describe("FoodLookupService.search", () => {
  it("cache hit: returns cached rows WITHOUT calling the source", async () => {
    const cachedRow = makeRow();
    const repo = makeRepo({
      findCachedByQuery: vi.fn(async () => [cachedRow]),
    });
    const source = new MockFoodSource({ searchResults: [makeResult()] });
    const searchSpy = vi.spyOn(source, "search");
    const service = new FoodLookupService({ repo, source });

    const results = await service.search(TENANT, "oats");

    expect(searchSpy).not.toHaveBeenCalled();
    expect(repo.insertResolved).not.toHaveBeenCalled();
    expect(results).toEqual([rowToFoodResult(cachedRow)]);
  });

  it("cache miss: calls source.search once and persists the results", async () => {
    const sourceResults = [makeResult()];
    const repo = makeRepo({ findCachedByQuery: vi.fn(async () => []) });
    const source = new MockFoodSource({ searchResults: sourceResults });
    const searchSpy = vi.spyOn(source, "search");
    const service = new FoodLookupService({ repo, source });

    const results = await service.search(TENANT, "oats", "en");

    expect(searchSpy).toHaveBeenCalledTimes(1);
    expect(repo.insertResolved).toHaveBeenCalledWith(TENANT, sourceResults);
    expect(results).toEqual(sourceResults);
  });
});

describe("FoodLookupService.getByRef / getByBarcode", () => {
  it("cache hit by ref: returns cached row WITHOUT calling the source", async () => {
    const cachedRow = makeRow({ source_ref: "123" });
    const repo = makeRepo({ findCachedByRef: vi.fn(async () => cachedRow) });
    const source = new MockFoodSource();
    const getRefSpy = vi.spyOn(source, "getByRef");
    const service = new FoodLookupService({ repo, source });

    const result = await service.getByRef(TENANT, "123");

    expect(getRefSpy).not.toHaveBeenCalled();
    expect(repo.insertResolved).not.toHaveBeenCalled();
    expect(result).toEqual(rowToFoodResult(cachedRow));
  });

  it("cache miss by ref: calls source, persists the one result, returns it", async () => {
    const sourceResult = makeResult({ sourceRef: "123", name: "Fetched" });
    const repo = makeRepo({ findCachedByRef: vi.fn(async () => null) });
    const source = new MockFoodSource({ byRef: { "123": sourceResult } });
    const getRefSpy = vi.spyOn(source, "getByRef");
    const service = new FoodLookupService({ repo, source });

    const result = await service.getByRef(TENANT, "123");

    expect(getRefSpy).toHaveBeenCalledTimes(1);
    expect(repo.insertResolved).toHaveBeenCalledWith(TENANT, [sourceResult]);
    expect(result).toEqual(sourceResult);
  });

  it("cache miss by barcode with no source match: returns null, no persist", async () => {
    const repo = makeRepo({ findCachedByRef: vi.fn(async () => null) });
    const source = new MockFoodSource();
    const service = new FoodLookupService({ repo, source });

    const result = await service.getByBarcode(TENANT, "000");

    expect(result).toBeNull();
    expect(repo.insertResolved).not.toHaveBeenCalled();
  });
});

describe("FoodLookupService.createManual", () => {
  it("calls insertManual and returns the mapped result", async () => {
    const manualRow = makeRow({
      source: "manual",
      source_ref: null,
      brand: null,
      name: "Manual Item",
    });
    const insertManual = vi.fn(async () => manualRow);
    const repo = makeRepo({ insertManual });
    const source = new MockFoodSource();
    const service = new FoodLookupService({ repo, source });

    const result = await service.createManual(TENANT, {
      name: "Manual Item",
      nutrientsPer100g: makeResult().nutrientsPer100g,
    });

    expect(insertManual).toHaveBeenCalledTimes(1);
    expect(result.source).toBe("manual");
    expect(result.sourceRef).toBeNull();
    expect(result.name).toBe("Manual Item");
  });
});
