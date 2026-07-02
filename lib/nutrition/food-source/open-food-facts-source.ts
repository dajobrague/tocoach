import type { FoodResult, FoodSource, NutrientsPer100g } from "./types";

const DEFAULT_BASE_URL = "https://world.openfoodfacts.org";
const DEFAULT_SEARCH_BASE_URL = "https://search.openfoodfacts.org";
const SEARCH_PAGE_SIZE = 40;
const DEFAULT_SEARCH_LANG = "es";
/**
 * Rank by crowd popularity so recognizable products surface first. Without a
 * sort the default text-match relevance returns foreign-language near-dupes
 * and low-quality entries ahead of the products users actually scan.
 */
const SEARCH_SORT_BY = "-unique_scans_n";
/** Abort slow OFF calls so the UI never hangs behind the external API. */
const REQUEST_TIMEOUT_MS = 8000;
/** OFF asks API consumers to identify themselves. */
const USER_AGENT = "TopCoach/1.0 (https://app.topcoach.io)";
/** Trim the search payload to what mapProduct reads (~5KB vs ~700KB). */
const SEARCH_FIELDS =
  "code,product_name,generic_name,brands,nutriments," +
  "image_front_small_url,image_small_url,image_url";

/**
 * {@link FoodSource} backed by the Open Food Facts (OFF) public API.
 *
 * Search uses the modern Search-a-licious service (search.openfoodfacts.org)
 * — the legacy `cgi/search.pl` endpoint is rate-limited to ~10 req/min and
 * intermittently answers 503, which surfaced as phantom "no results" in the
 * UI. Barcode/ref lookups stay on the v2 product API.
 *
 * The HTTP layer is injected (`fetchFn`) so tests never touch the network.
 * OFF responses are untrusted/loosely-typed JSON, so every field is read
 * through the defensive coercion helpers below — missing or malformed values
 * degrade to `0`/`null` rather than throwing or leaking `any`.
 */
export class OpenFoodFactsSource implements FoodSource {
  private readonly fetchFn: typeof fetch;
  private readonly baseUrl: string;
  private readonly searchBaseUrl: string;

  constructor(
    fetchFn: typeof fetch = globalThis.fetch,
    baseUrl: string = DEFAULT_BASE_URL,
    searchBaseUrl: string = DEFAULT_SEARCH_BASE_URL
  ) {
    this.fetchFn = fetchFn;
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.searchBaseUrl = searchBaseUrl.replace(/\/+$/, "");
  }

  async search(
    query: string,
    locale?: string,
    country?: string,
    brand?: string
  ): Promise<FoodResult[]> {
    const langs =
      locale !== undefined && locale.length > 0 ? locale : DEFAULT_SEARCH_LANG;
    // Fold optional Lucene filter clauses into the query: a country scope and a
    // brand narrowing. Omitting both searches the world catalogue (prior behavior).
    const filters: string[] = [];

    if (country !== undefined && country.length > 0) {
      filters.push(`countries_tags:"en:${country}"`);
    }

    const cleanBrand = brand?.trim() ?? "";

    if (cleanBrand.length > 0) {
      // Escape backslashes and quotes so user text can't break out of the
      // quoted Lucene clause (e.g. a brand like `Bob "Organic"`).
      const escaped = cleanBrand.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

      filters.push(`brands:"${escaped}"`);
    }

    const q = filters.length > 0 ? `${query} ${filters.join(" ")}` : query;
    const url =
      `${this.searchBaseUrl}/search?q=${encodeURIComponent(q)}` +
      `&langs=${encodeURIComponent(langs)}` +
      `&page_size=${SEARCH_PAGE_SIZE}&sort_by=${SEARCH_SORT_BY}` +
      `&fields=${SEARCH_FIELDS}`;
    const json = await this.fetchJson(url);
    const hits = asArray(asRecord(json)["hits"]);

    const results: FoodResult[] = [];

    for (const product of hits) {
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
    const response = await this.fetchFn(url, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: { "User-Agent": USER_AGENT },
    });

    if (response.ok === false) {
      return null;
    }

    return (await response.json()) as unknown;
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
  const brand = mapBrand(record["brands"]);

  if (brand !== null) {
    // Only set when present — never assign `undefined` (exactOptionalPropertyTypes).
    result.brand = brand;
  }

  const imageUrl = mapImageUrl(record);

  if (imageUrl !== null) {
    result.imageUrl = imageUrl;
  }

  return result;
}

/**
 * Pick a thumbnail, smallest first: the 200px front image is ideal for a list
 * row; fall back to the generic small image, then the full-size image.
 */
function mapImageUrl(record: Record<string, unknown>): string | null {
  return (
    asNonEmptyString(record["image_front_small_url"]) ??
    asNonEmptyString(record["image_small_url"]) ??
    asNonEmptyString(record["image_url"])
  );
}

/**
 * Brands come back as a comma-separated string (v2 product API) or an array
 * of strings (Search-a-licious); either way, surface the first brand only.
 */
function mapBrand(value: unknown): string | null {
  if (Array.isArray(value)) {
    for (const entry of value) {
      const brand = asNonEmptyString(entry);

      if (brand !== null) {
        return brand;
      }
    }

    return null;
  }

  const raw = asNonEmptyString(value);

  if (raw === null) {
    return null;
  }

  return asNonEmptyString(raw.split(",")[0]);
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
