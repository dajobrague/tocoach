import type { FoodResult, FoodSource, NutrientsPer100g } from "./types";

const DEFAULT_BASE_URL = "https://world.openfoodfacts.org";
const SEARCH_PAGE_SIZE = 20;

/**
 * {@link FoodSource} backed by the Open Food Facts (OFF) public API.
 *
 * The HTTP layer is injected (`fetchFn`) so tests never touch the network.
 * OFF responses are untrusted/loosely-typed JSON, so every field is read
 * through the defensive coercion helpers below — missing or malformed values
 * degrade to `0`/`null` rather than throwing or leaking `any`.
 */
export class OpenFoodFactsSource implements FoodSource {
  private readonly fetchFn: typeof fetch;
  private readonly baseUrl: string;

  constructor(
    fetchFn: typeof fetch = globalThis.fetch,
    baseUrl: string = DEFAULT_BASE_URL
  ) {
    this.fetchFn = fetchFn;
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  async search(query: string, locale?: string): Promise<FoodResult[]> {
    const host = this.hostForLocale(locale);
    const url =
      `${host}/cgi/search.pl?search_terms=${encodeURIComponent(query)}` +
      `&search_simple=1&action=process&json=1&page_size=${SEARCH_PAGE_SIZE}`;
    const json = await this.fetchJson(url);
    const products = asArray(asRecord(json)["products"]);

    const results: FoodResult[] = [];

    for (const product of products) {
      const mapped = mapProduct(product);

      if (mapped !== null) {
        results.push(mapped);
      }
    }

    return results;
  }

  async getByBarcode(code: string): Promise<FoodResult | null> {
    return this.lookupByCode(code);
  }

  async getByRef(sourceRef: string): Promise<FoodResult | null> {
    // For OFF the `sourceRef` is the product barcode, so both share a lookup.
    return this.lookupByCode(sourceRef);
  }

  private async lookupByCode(code: string): Promise<FoodResult | null> {
    const url = `${this.baseUrl}/api/v2/product/${encodeURIComponent(code)}.json`;
    const record = asRecord(await this.fetchJson(url));

    // OFF signals "not found" with status: 0 (and/or an absent product).
    if (toNumber(record["status"]) === 0) {
      return null;
    }

    const product = record["product"];

    if (product === undefined || product === null) {
      return null;
    }

    return mapProduct(product, code);
  }

  private async fetchJson(url: string): Promise<unknown> {
    const response = await this.fetchFn(url);

    if (response.ok === false) {
      return null;
    }

    return (await response.json()) as unknown;
  }

  private hostForLocale(locale?: string): string {
    if (locale === undefined || locale.length === 0) {
      return this.baseUrl;
    }

    try {
      const url = new URL(this.baseUrl);

      if (url.hostname.endsWith("openfoodfacts.org")) {
        const labels = url.hostname.split(".");

        labels[0] = locale;
        url.hostname = labels.join(".");

        return url.origin;
      }
    } catch {
      // Non-URL base (e.g. a test stub) — fall back to the configured base.
    }

    return this.baseUrl;
  }
}

/** Map a single OFF product (unknown shape) to a {@link FoodResult}. */
function mapProduct(
  product: unknown,
  fallbackCode?: string
): FoodResult | null {
  const record = asRecord(product);
  const name =
    asNonEmptyString(record["product_name"]) ??
    asNonEmptyString(record["generic_name"]);

  if (name === null) {
    // No usable name → skip this product entirely.
    return null;
  }

  const code = asNonEmptyString(record["code"]) ?? fallbackCode ?? null;
  const result: FoodResult = {
    source: "off",
    sourceRef: code,
    name,
    defaultUnit: "g",
    nutrientsPer100g: mapNutriments(asRecord(record["nutriments"])),
  };
  const brand = asNonEmptyString(record["brands"]);

  if (brand !== null) {
    // Only set when present — never assign `undefined` (exactOptionalPropertyTypes).
    result.brand = brand;
  }

  return result;
}

/** Map OFF per-100g nutriments to our set; missing/NaN → 0, sodium g → mg. */
function mapNutriments(nutriments: Record<string, unknown>): NutrientsPer100g {
  return {
    kcal: toNumber(nutriments["energy-kcal_100g"]),
    protein_g: toNumber(nutriments["proteins_100g"]),
    carbs_g: toNumber(nutriments["carbohydrates_100g"]),
    fat_g: toNumber(nutriments["fat_100g"]),
    sugar_g: toNumber(nutriments["sugars_100g"]),
    fiber_g: toNumber(nutriments["fiber_100g"]),
    sat_fat_g: toNumber(nutriments["saturated-fat_100g"]),
    sodium_mg: toNumber(nutriments["sodium_100g"]) * 1000,
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  if (
    typeof value === "object" &&
    value !== null &&
    Array.isArray(value) === false
  ) {
    return value as Record<string, unknown>;
  }

  return {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();

    return trimmed.length > 0 ? trimmed : null;
  }

  return null;
}

/** Coerce an unknown OFF value to a finite number; anything else becomes 0. */
function toNumber(value: unknown): number {
  const n = Number(value);

  return Number.isFinite(n) ? n : 0;
}
