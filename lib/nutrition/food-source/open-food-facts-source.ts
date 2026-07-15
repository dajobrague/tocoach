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
/** Abort a slow OFF call so the UI never hangs; a failed primary search falls
 *  back to the legacy endpoint, so keep this reasonably tight. */
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
 * Search tries the modern Search-a-licious service (search.openfoodfacts.org)
 * first and falls back to the legacy `cgi/search.pl` endpoint on the product
 * host when Search-a-licious is unavailable — that service has had full
 * outages (every path, incl. /health, answering 502) while the legacy endpoint
 * stayed up. Legacy is only the fallback because it is rate-limited (~10
 * req/min/IP). Barcode/ref lookups stay on the v2 product API.
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
    const cleanBrand = brand?.trim() ?? "";

    // Primary: Search-a-licious. When it is unavailable (5xx / network /
    // timeout) it returns null and we fall back to the legacy CGI search on the
    // product host, which stays up when Search-a-licious is down. Legacy is only
    // the fallback because it is rate-limited (~10 req/min/IP). Both failing
    // yields [] — the caller's local-first layer still answers.
    const primary = await this.searchViaSearchalicious(
      query,
      langs,
      country,
      cleanBrand
    );

    if (primary !== null) {
      return primary;
    }

    const fallback = await this.searchViaLegacy(
      query,
      langs,
      country,
      cleanBrand
    );

    return fallback ?? [];
  }

  /**
   * Search-a-licious (search.openfoodfacts.org). Returns mapped results on a
   * successful response, or null when the service is unavailable (so the caller
   * can fall back). Country/brand narrow via Lucene clauses folded into `q`.
   */
  private async searchViaSearchalicious(
    query: string,
    langs: string,
    country: string | undefined,
    brand: string
  ): Promise<FoodResult[] | null> {
    const filters: string[] = [];

    if (country !== undefined && country.length > 0) {
      filters.push(`countries_tags:"en:${country}"`);
    }

    if (brand.length > 0) {
      // Escape backslashes and quotes so user text can't break out of the
      // quoted Lucene clause (e.g. a brand like `Bob "Organic"`).
      const escaped = brand.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

      filters.push(`brands:"${escaped}"`);
    }

    const q = filters.length > 0 ? `${query} ${filters.join(" ")}` : query;
    const url =
      `${this.searchBaseUrl}/search?q=${encodeURIComponent(q)}` +
      `&langs=${encodeURIComponent(langs)}` +
      `&page_size=${SEARCH_PAGE_SIZE}&sort_by=${SEARCH_SORT_BY}` +
      `&fields=${SEARCH_FIELDS}`;
    const json = await this.fetchJsonOrNull(url);

    if (json === null) {
      return null;
    }

    return mapProducts(asArray(asRecord(json)["hits"]));
  }

  /**
   * Legacy CGI search (world.openfoodfacts.org/cgi/search.pl) — the fallback
   * for when Search-a-licious is down. Same fields/shape via {@link mapProduct};
   * country and brand narrow via OFF tag filters. Returns null when unavailable.
   */
  private async searchViaLegacy(
    query: string,
    langs: string,
    country: string | undefined,
    brand: string
  ): Promise<FoodResult[] | null> {
    const params = new URLSearchParams({
      search_terms: query,
      search_simple: "1",
      action: "process",
      json: "1",
      page_size: String(SEARCH_PAGE_SIZE),
      fields: SEARCH_FIELDS,
      lc: langs,
    });

    let tag = 0;

    if (country !== undefined && country.length > 0) {
      params.set(`tagtype_${tag}`, "countries");
      params.set(`tag_contains_${tag}`, "contains");
      params.set(`tag_${tag}`, country);
      tag += 1;
    }

    if (brand.length > 0) {
      params.set(`tagtype_${tag}`, "brands");
      params.set(`tag_contains_${tag}`, "contains");
      params.set(`tag_${tag}`, brand);
      tag += 1;
    }

    const url = `${this.baseUrl}/cgi/search.pl?${params.toString()}`;
    const json = await this.fetchJsonOrNull(url);

    if (json === null) {
      return null;
    }

    return mapProducts(asArray(asRecord(json)["products"]));
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

  /** {@link fetchJson} but a network/timeout error becomes null (unavailable)
   *  rather than throwing — lets the search fallback chain try the next
   *  endpoint on any failure, not only a non-OK HTTP status. */
  private async fetchJsonOrNull(url: string): Promise<unknown> {
    try {
      return await this.fetchJson(url);
    } catch {
      return null;
    }
  }

  private async fetchJson(url: string): Promise<unknown> {
    const startedAt = Date.now();
    // Request tracing: record which OFF host/path we hit, the HTTP status, and
    // how long it took — makes outages/rate-limits visible in prod logs and
    // shows when the primary→legacy fallback fires.
    let target = url;

    try {
      const parsed = new URL(url);

      target = `${parsed.host}${parsed.pathname}`;
    } catch {
      target = url;
    }

    try {
      const response = await this.fetchFn(url, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        headers: { "User-Agent": USER_AGENT },
      });

      console.log("[OFF fetch]", {
        target,
        status: response.status,
        elapsedMs: Date.now() - startedAt,
      });

      if (response.ok === false) {
        return null;
      }

      return (await response.json()) as unknown;
    } catch (error) {
      console.error("[OFF fetch] failed", {
        target,
        elapsedMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }
}

/** Map an array of OFF products (Search-a-licious `hits` or legacy `products`)
 *  to results, dropping any without a usable name. */
function mapProducts(items: unknown[]): FoodResult[] {
  const results: FoodResult[] = [];

  for (const item of items) {
    const mapped = mapProduct(item);

    if (mapped !== null) {
      results.push(mapped);
    }
  }

  return results;
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

  const serving = mapServing(record);

  if (serving.servingSize !== null) {
    result.servingSize = serving.servingSize;
  }

  if (serving.servingQuantity !== null) {
    result.servingQuantity = serving.servingQuantity;
    result.servingQuantityUnit = serving.servingQuantityUnit;
  }

  return result;
}

/**
 * Extract serving data from an OFF product, defensively (see the OFF data
 * pitfalls: only the v2 product API carries these fields — the
 * Search-a-licious index does not — `serving_quantity` is sometimes a string,
 * `serving_size` is free text that can literally be `"null"`, and beverages
 * are in ml, not g).
 *
 * The numeric weight is established in priority order:
 * 1. `serving_quantity` (coerced; must be a positive finite number),
 * 2. a number parsed from the `serving_size` text ("2 rebanadas (60 g)" → 60),
 * 3. back-computed from `energy-kcal_serving / energy-kcal_100g × 100`.
 */
function mapServing(record: Record<string, unknown>): {
  servingSize: string | null;
  servingQuantity: number | null;
  servingQuantityUnit: "g" | "ml";
} {
  const servingSize = sanitizeServingText(record["serving_size"]);

  // Unit: prefer the explicit serving unit; fall back to the package unit
  // (a beverage's package is ml too); grams only as the last resort.
  const explicitUnit = normalizeServingUnit(record["serving_quantity_unit"]);
  const packageUnit = normalizeServingUnit(record["product_quantity_unit"]);
  let servingQuantityUnit = explicitUnit ?? packageUnit ?? "g";

  let servingQuantity = toPositiveNumber(record["serving_quantity"]);

  if (servingQuantity === null && servingSize !== null) {
    const parsed = parseWeightFromText(servingSize);

    servingQuantity = parsed?.weight ?? null;

    // "1 vaso (250 ml)" carries its own unit — trust it over the g default
    // when no explicit serving/package unit was present.
    if (parsed !== null && explicitUnit === null && packageUnit === null) {
      servingQuantityUnit = parsed.unit;
    }
  }

  if (servingQuantity === null) {
    const nutriments = asRecord(record["nutriments"]);
    const per100 = toPositiveNumber(nutriments["energy-kcal_100g"]);
    const perServing = toPositiveNumber(nutriments["energy-kcal_serving"]);

    if (per100 !== null && perServing !== null) {
      servingQuantity = Math.round((perServing / per100) * 100);
    }
  }

  return { servingSize, servingQuantity, servingQuantityUnit };
}

/** Serving text is contributor free text; discard placeholders ("null",
 *  "serving", lone dashes) that OFF itself flags as data-quality errors. */
function sanitizeServingText(value: unknown): string | null {
  const text = asNonEmptyString(value);

  if (text === null) {
    return null;
  }

  const lowered = text.toLowerCase();

  if (lowered === "null" || lowered === "serving" || /^[-–—.]+$/.test(text)) {
    return null;
  }

  return text;
}

function normalizeServingUnit(value: unknown): "g" | "ml" | null {
  const unit = asNonEmptyString(value)?.toLowerCase() ?? null;

  if (unit === "g" || unit === "gr") {
    return "g";
  }

  if (unit === "ml") {
    return "ml";
  }

  return null;
}

/** First "<number> g|gr|ml" in a serving text (comma decimals accepted),
 *  with the unit it was written in. */
function parseWeightFromText(
  text: string
): { weight: number; unit: "g" | "ml" } | null {
  const match = /(\d+(?:[.,]\d+)?)\s*(g|gr|ml)\b/i.exec(text);

  if (match === null || match[1] === undefined || match[2] === undefined) {
    return null;
  }

  const weight = toPositiveNumber(Number(match[1].replace(",", ".")));

  if (weight === null) {
    return null;
  }

  return { weight, unit: match[2].toLowerCase() === "ml" ? "ml" : "g" };
}

/** Coerce to a positive finite number (strings accepted); anything else → null. */
function toPositiveNumber(value: unknown): number | null {
  const n = Number(value);

  return Number.isFinite(n) && n > 0 ? n : null;
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
