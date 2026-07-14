import type { CommonFoodsRepository } from "../common-foods-repository";
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
    image_url: null,
    default_unit: "g",
    kcal: 389,
    protein_g: 16.9,
    carbs_g: 66.3,
    fat_g: 6.9,
    sugar_g: 0,
    fiber_g: 10.6,
    sat_fat_g: 1.2,
    sodium_mg: 2,
    serving_size: null,
    serving_quantity: null,
    serving_quantity_unit: null,
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
    findById: vi.fn(async () => null),
    updateServing: vi.fn(async () => null),
    findCachedByRef: vi.fn(async () => null),
    insertResolved: vi.fn(async () => []),
    insertManual: vi.fn(async () => makeRow({ source: "manual" })),
    ...overrides,
  };
}

function makeCommonFoods(results: FoodResult[] = []): CommonFoodsRepository {
  return { search: vi.fn(async () => results) };
}

/** Six distinct cached rows — enough to satisfy MIN_LOCAL_RESULTS. */
function manyCachedRows(): IngredientRow[] {
  return Array.from({ length: 6 }, (_, i) =>
    makeRow({
      id: `00000000-0000-0000-0000-00000000000${i + 1}`,
      source_ref: `off:cached-${i + 1}`,
      name: `Cached Oats ${i + 1}`,
    })
  );
}

describe("FoodLookupService.search", () => {
  it("enough local results: returns cached rows WITHOUT calling the source", async () => {
    const cachedRows = manyCachedRows();
    const repo = makeRepo({
      findCachedByQuery: vi.fn(async () => cachedRows),
    });
    const source = new MockFoodSource({ searchResults: [makeResult()] });
    const searchSpy = vi.spyOn(source, "search");
    const service = new FoodLookupService({ repo, source });

    const results = await service.search(TENANT, "oats");

    expect(searchSpy).not.toHaveBeenCalled();
    expect(results).toHaveLength(cachedRows.length);
    expect(results.map((r) => r.id)).toEqual(
      expect.arrayContaining(cachedRows.map((r) => r.id))
    );
  });

  it("scarce local results: calls source.search once and persists the results", async () => {
    const sourceResult = makeResult();
    const insertedRow = makeRow({
      id: "00000000-0000-0000-0000-0000000000ff",
      source_ref: sourceResult.sourceRef,
      name: sourceResult.name,
      brand: null,
    });
    const insertResolved = vi.fn(async () => [insertedRow]);
    const repo = makeRepo({ insertResolved });
    const source = new MockFoodSource({ searchResults: [sourceResult] });
    const searchSpy = vi.spyOn(source, "search");
    const service = new FoodLookupService({ repo, source });

    const results = await service.search(TENANT, "oats", "en");

    expect(searchSpy).toHaveBeenCalledTimes(1);
    expect(insertResolved).toHaveBeenCalledWith(TENANT, [sourceResult]);
    // The persisted cache row (with id) is returned, not the raw source hit.
    expect(results).toEqual([rowToFoodResult(insertedRow)]);
  });

  it("forwards the country market to the external source", async () => {
    const source = new MockFoodSource({ searchResults: [] });
    const searchSpy = vi.spyOn(source, "search");
    const service = new FoodLookupService({ repo: makeRepo(), source });

    await service.search(TENANT, "yogur", "es", "spain");

    expect(searchSpy).toHaveBeenCalledWith("yogur", "es", "spain", undefined);
  });

  it("with a brand: queries the source even when local results are plentiful", async () => {
    const cachedRows = manyCachedRows(); // 6 rows → would normally skip source
    const brandedResult = makeResult({
      source: "off",
      sourceRef: "off:h1",
      name: "Yogur Hacendado",
      brand: "Hacendado",
    });
    const insertedRow = makeRow({
      id: "00000000-0000-0000-0000-0000000000h1",
      source_ref: "off:h1",
      name: "Yogur Hacendado",
      brand: "Hacendado",
    });
    const repo = makeRepo({
      findCachedByQuery: vi.fn(async () => cachedRows),
      insertResolved: vi.fn(async () => [insertedRow]),
    });
    const source = new MockFoodSource({ searchResults: [brandedResult] });
    const searchSpy = vi.spyOn(source, "search");
    const service = new FoodLookupService({ repo, source });

    const results = await service.search(
      TENANT,
      "yogur",
      "es",
      "spain",
      "hacendado"
    );

    expect(searchSpy).toHaveBeenCalledWith("yogur", "es", "spain", "hacendado");
    // Only brand matches survive — the 6 "CachedBrand" rows are filtered out.
    expect(results.every((r) => r.brand === "Hacendado")).toBe(true);
    expect(results).toHaveLength(1);
  });

  it("with a brand: filters out cached rows that do not match the brand", async () => {
    const rows = [
      makeRow({ source_ref: "off:1", name: "Yogur A", brand: "Hacendado" }),
      makeRow({ source_ref: "off:2", name: "Yogur B", brand: "Danone" }),
      makeRow({ source_ref: "off:3", name: "Yogur C", brand: null }),
    ];
    const repo = makeRepo({ findCachedByQuery: vi.fn(async () => rows) });
    const source = new MockFoodSource({ searchResults: [] });
    const service = new FoodLookupService({ repo, source });

    const results = await service.search(
      TENANT,
      "yogur",
      undefined,
      undefined,
      "hacendado"
    );

    expect(results.map((r) => r.brand)).toEqual(["Hacendado"]);
  });

  it("merges seed foods and persists the ones not yet cached", async () => {
    const seedResult = makeResult({
      source: "seed",
      sourceRef: "seed-uuid-1",
      name: "Manzana",
    });
    const insertedRow = makeRow({
      id: "00000000-0000-0000-0000-0000000000aa",
      source: "seed",
      source_ref: "seed-uuid-1",
      name: "Manzana",
      brand: null,
    });
    const insertResolved = vi.fn(async () => [insertedRow]);
    const repo = makeRepo({ insertResolved });
    const source = new MockFoodSource({ searchResults: [] });
    const commonFoods = makeCommonFoods([seedResult]);
    const service = new FoodLookupService({ repo, source, commonFoods });

    const results = await service.search(TENANT, "manzana");

    expect(commonFoods.search).toHaveBeenCalledWith("manzana");
    expect(insertResolved).toHaveBeenCalledWith(TENANT, [seedResult]);
    expect(results).toEqual([rowToFoodResult(insertedRow)]);
  });

  it("does NOT re-persist seed foods already in the tenant cache", async () => {
    const cachedSeedRow = makeRow({
      source: "seed",
      source_ref: "seed-uuid-1",
      name: "Manzana",
      brand: null,
    });
    const insertResolved = vi.fn(async () => []);
    const repo = makeRepo({
      findCachedByQuery: vi.fn(async () => [cachedSeedRow]),
      insertResolved,
    });
    const source = new MockFoodSource({ searchResults: [] });
    const commonFoods = makeCommonFoods([
      makeResult({ source: "seed", sourceRef: "seed-uuid-1", name: "Manzana" }),
    ]);
    const service = new FoodLookupService({ repo, source, commonFoods });

    const results = await service.search(TENANT, "manzana");

    expect(insertResolved).toHaveBeenCalledWith(TENANT, []);
    expect(results).toEqual([rowToFoodResult(cachedSeedRow)]);
  });

  it("external source failure degrades to local results, not an error", async () => {
    const cachedRow = makeRow();
    const repo = makeRepo({
      findCachedByQuery: vi.fn(async () => [cachedRow]),
    });
    const source = new MockFoodSource();

    vi.spyOn(source, "search").mockRejectedValue(new Error("OFF timeout"));

    const service = new FoodLookupService({ repo, source });

    const results = await service.search(TENANT, "oats");

    expect(results).toEqual([rowToFoodResult(cachedRow)]);
  });

  it("ranks exact and prefix name matches before substring matches", async () => {
    const rows = [
      makeRow({
        id: "00000000-0000-0000-0000-000000000001",
        source_ref: "r1",
        name: "Caldo de pollo",
      }),
      makeRow({
        id: "00000000-0000-0000-0000-000000000002",
        source_ref: "r2",
        name: "Pollo asado",
      }),
      makeRow({
        id: "00000000-0000-0000-0000-000000000003",
        source_ref: "r3",
        name: "Pollo",
      }),
    ];
    const repo = makeRepo({ findCachedByQuery: vi.fn(async () => rows) });
    const source = new MockFoodSource({ searchResults: [] });
    const service = new FoodLookupService({ repo, source });

    const results = await service.search(TENANT, "pollo");

    expect(results.map((r) => r.name)).toEqual([
      "Pollo",
      "Pollo asado",
      "Caldo de pollo",
    ]);
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

  it("cache miss by ref: calls source, persists, returns the cache row", async () => {
    const sourceResult = makeResult({ sourceRef: "123", name: "Fetched" });
    const insertedRow = makeRow({
      id: "00000000-0000-0000-0000-0000000000bb",
      source_ref: "123",
      name: "Fetched",
      brand: null,
    });
    const insertResolved = vi.fn(async () => [insertedRow]);
    const repo = makeRepo({
      findCachedByRef: vi.fn(async () => null),
      insertResolved,
    });
    const source = new MockFoodSource({ byRef: { "123": sourceResult } });
    const getRefSpy = vi.spyOn(source, "getByRef");
    const service = new FoodLookupService({ repo, source });

    const result = await service.getByRef(TENANT, "123");

    expect(getRefSpy).toHaveBeenCalledTimes(1);
    expect(insertResolved).toHaveBeenCalledWith(TENANT, [sourceResult]);
    expect(result).toEqual(rowToFoodResult(insertedRow));
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

describe("FoodLookupService.enrichServing", () => {
  it("hydrates serving data from the source and persists it", async () => {
    const row = makeRow({ source: "off", source_ref: "111" });
    const updated = makeRow({
      source: "off",
      source_ref: "111",
      serving_size: "2 rebanadas (60 g)",
      serving_quantity: 60,
      serving_quantity_unit: "g",
    });
    const repo = makeRepo({
      findById: vi.fn(async () => row),
      updateServing: vi.fn(async () => updated),
    });
    const source = new MockFoodSource({
      byRef: {
        "111": makeResult({
          sourceRef: "111",
          servingSize: "2 rebanadas (60 g)",
          servingQuantity: 60,
          servingQuantityUnit: "g",
        }),
      },
    });
    const service = new FoodLookupService({ repo, source });

    const result = await service.enrichServing(TENANT, row.id);

    expect(repo.updateServing).toHaveBeenCalledWith(TENANT, row.id, {
      serving_size: "2 rebanadas (60 g)",
      serving_quantity: 60,
      serving_quantity_unit: "g",
    });
    expect(result?.servingQuantity).toBe(60);
    expect(result?.servingSize).toBe("2 rebanadas (60 g)");
  });

  it("marks a no-data product as checked so it is never re-fetched", async () => {
    const row = makeRow({ source: "off", source_ref: "111" });
    const repo = makeRepo({
      findById: vi.fn(async () => row),
      updateServing: vi.fn(async () =>
        makeRow({
          source: "off",
          source_ref: "111",
          serving_quantity_unit: "none",
        })
      ),
    });
    // Source knows the product but has no serving data.
    const source = new MockFoodSource({
      byRef: { "111": makeResult({ sourceRef: "111" }) },
    });
    const service = new FoodLookupService({ repo, source });

    const result = await service.enrichServing(TENANT, row.id);

    expect(repo.updateServing).toHaveBeenCalledWith(TENANT, row.id, {
      serving_size: null,
      serving_quantity: null,
      serving_quantity_unit: "none",
    });
    expect(result?.servingQuantity).toBeUndefined();
  });

  it("skips the network entirely for an already-checked row", async () => {
    const row = makeRow({
      source: "off",
      source_ref: "111",
      serving_quantity_unit: "none",
    });
    const repo = makeRepo({ findById: vi.fn(async () => row) });
    const source = new MockFoodSource();
    const getRefSpy = vi.spyOn(source, "getByRef");
    const service = new FoodLookupService({ repo, source });

    await service.enrichServing(TENANT, row.id);

    expect(getRefSpy).not.toHaveBeenCalled();
    expect(repo.updateServing).not.toHaveBeenCalled();
  });

  it("degrades to the cached row when the source fails", async () => {
    const row = makeRow({ source: "off", source_ref: "111" });
    const repo = makeRepo({ findById: vi.fn(async () => row) });
    const source = new MockFoodSource();

    vi.spyOn(source, "getByRef").mockRejectedValue(new Error("503"));
    const service = new FoodLookupService({ repo, source });

    const result = await service.enrichServing(TENANT, row.id);

    expect(result?.name).toBe(row.name);
    expect(repo.updateServing).not.toHaveBeenCalled();
  });

  it("returns null for an unknown id (cross-tenant safe)", async () => {
    const repo = makeRepo({ findById: vi.fn(async () => null) });
    const service = new FoodLookupService({
      repo,
      source: new MockFoodSource(),
    });

    expect(await service.enrichServing(TENANT, "nope")).toBeNull();
  });
});
