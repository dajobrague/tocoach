import { describe, expect, it } from "vitest";

import { OpenFoodFactsSource } from "../open-food-facts-source";

/** Build a fake `fetch` that records request URLs and returns canned JSON. */
function stubFetch(payload: unknown, status = 200) {
  const calls: string[] = [];
  const fetchFn: typeof fetch = async (input) => {
    calls.push(String(input));

    return new Response(JSON.stringify(payload), {
      status,
      headers: { "content-type": "application/json" },
    });
  };

  return { fetchFn, calls };
}

const searchPayload = {
  products: [
    {
      code: "0123",
      product_name: "Greek Yogurt",
      brands: "Fage",
      nutriments: {
        "energy-kcal_100g": 97,
        proteins_100g: "10", // string value → coerced to number
        carbohydrates_100g: 3.6,
        fat_100g: 5,
        sugars_100g: 3.6,
        // fiber_100g intentionally missing → 0
        "saturated-fat_100g": 3.3,
        sodium_100g: 0.05, // grams → 50 mg
      },
    },
  ],
};

describe("OpenFoodFactsSource.search", () => {
  it("maps OFF products to FoodResult with correct fields", async () => {
    const { fetchFn, calls } = stubFetch(searchPayload);
    const source = new OpenFoodFactsSource(fetchFn, "https://stub.test");

    const results = await source.search("yogurt");

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      source: "off",
      sourceRef: "0123",
      name: "Greek Yogurt",
      brand: "Fage",
      defaultUnit: "g",
      nutrientsPer100g: {
        kcal: 97,
        protein_g: 10,
        carbs_g: 3.6,
        fat_g: 5,
        sugar_g: 3.6,
        fiber_g: 0,
        sat_fat_g: 3.3,
        sodium_mg: 50,
      },
    });
    expect(calls[0] ?? "").toContain("/cgi/search.pl?search_terms=yogurt");
    expect(calls[0] ?? "").toContain("page_size=20");
  });

  it("coerces a missing nutriment to 0", async () => {
    const { fetchFn } = stubFetch(searchPayload);
    const source = new OpenFoodFactsSource(fetchFn, "https://stub.test");

    const results = await source.search("yogurt");

    expect(results[0]?.nutrientsPer100g.fiber_g).toBe(0);
  });

  it("coerces a string-valued nutriment to a number", async () => {
    const { fetchFn } = stubFetch(searchPayload);
    const source = new OpenFoodFactsSource(fetchFn, "https://stub.test");

    const results = await source.search("yogurt");

    expect(results[0]?.nutrientsPer100g.protein_g).toBe(10);
  });

  it("converts sodium grams to milligrams", async () => {
    const { fetchFn } = stubFetch(searchPayload);
    const source = new OpenFoodFactsSource(fetchFn, "https://stub.test");

    const results = await source.search("yogurt");

    expect(results[0]?.nutrientsPer100g.sodium_mg).toBe(50);
  });

  it("returns an empty array when OFF returns no products", async () => {
    const { fetchFn } = stubFetch({ products: [] });
    const source = new OpenFoodFactsSource(fetchFn, "https://stub.test");

    expect(await source.search("nothing")).toEqual([]);
  });

  it("skips products without any usable name", async () => {
    const { fetchFn } = stubFetch({
      products: [{ code: "9", nutriments: {} }],
    });
    const source = new OpenFoodFactsSource(fetchFn, "https://stub.test");

    expect(await source.search("noname")).toEqual([]);
  });
});

describe("OpenFoodFactsSource.getByBarcode / getByRef", () => {
  it("returns a FoodResult for a found product", async () => {
    const { fetchFn, calls } = stubFetch({
      status: 1,
      product: {
        code: "555",
        product_name: "Olive Oil",
        nutriments: { "energy-kcal_100g": 884, fat_100g: 100 },
      },
    });
    const source = new OpenFoodFactsSource(fetchFn, "https://stub.test");

    const result = await source.getByBarcode("555");

    expect(result?.source).toBe("off");
    expect(result?.sourceRef).toBe("555");
    expect(result?.name).toBe("Olive Oil");
    expect(result?.nutrientsPer100g.kcal).toBe(884);
    expect(result?.nutrientsPer100g.sodium_mg).toBe(0);
    expect(calls[0] ?? "").toContain("/api/v2/product/555.json");
  });

  it("returns null when OFF reports status 0 (not found)", async () => {
    const { fetchFn } = stubFetch({ status: 0 });
    const source = new OpenFoodFactsSource(fetchFn, "https://stub.test");

    expect(await source.getByBarcode("000")).toBeNull();
  });

  it("getByRef shares the barcode lookup", async () => {
    const { fetchFn } = stubFetch({
      status: 1,
      product: { code: "777", product_name: "Almonds", nutriments: {} },
    });
    const source = new OpenFoodFactsSource(fetchFn, "https://stub.test");

    const result = await source.getByRef("777");

    expect(result?.sourceRef).toBe("777");
    expect(result?.name).toBe("Almonds");
  });

  it("falls back to a generic name and request code when fields are sparse", async () => {
    const { fetchFn } = stubFetch({
      status: 1,
      product: { generic_name: "Cereal", nutriments: {} },
    });
    const source = new OpenFoodFactsSource(fetchFn, "https://stub.test");

    const result = await source.getByRef("888");

    expect(result?.name).toBe("Cereal");
    expect(result?.sourceRef).toBe("888");
  });
});
