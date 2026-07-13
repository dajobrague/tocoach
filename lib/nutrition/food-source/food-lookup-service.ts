import type { CommonFoodsRepository } from "./common-foods-repository";
import type {
  IngredientRepository,
  ManualIngredientInput,
} from "./ingredient-repository";
import type { FoodResult, FoodSource } from "./types";

import { normalizeFoodQuery } from "./common-foods-repository";
import { rowToFoodResult } from "./ingredient-repository";

/**
 * When the local layers (tenant cache + common-foods seed) already yield at
 * least this many results, the external source is skipped entirely — local
 * hits answer in one DB round-trip while OFF takes 1.5-4s.
 */
const MIN_LOCAL_RESULTS = 6;

export interface FoodLookupServiceDeps {
  repo: IngredientRepository;
  source: FoodSource;
  /** Optional global raw/common foods seed merged into every search. */
  commonFoods?: CommonFoodsRepository;
}

/**
 * Local-first food lookup. Searches the tenant ingredient cache and the
 * global common-foods seed in parallel; the external {@link FoodSource} is
 * only consulted when local results are scarce, and an external failure
 * (OFF 503/timeout) degrades to local results instead of "no results"
 * (nutrition-v2 invariant §4.5: switching the food source never mutates
 * already-cached ingredients).
 *
 * Fresh source/seed hits are persisted to the tenant cache and returned AS
 * cache rows, so every result carries a row id and is immediately attachable
 * as a meal_slot_option.
 *
 * Every method takes `tenantHost` explicitly — tenant scoping is never implicit.
 */
export class FoodLookupService {
  private readonly repo: IngredientRepository;
  private readonly source: FoodSource;
  private readonly commonFoods: CommonFoodsRepository | null;

  constructor(deps: FoodLookupServiceDeps) {
    this.repo = deps.repo;
    this.source = deps.source;
    this.commonFoods = deps.commonFoods ?? null;
  }

  async search(
    tenantHost: string,
    query: string,
    locale?: string,
    country?: string,
    brand?: string
  ): Promise<FoodResult[]> {
    const hasBrand = brand !== undefined && brand.length > 0;
    const [cachedRows, seedResults] = await Promise.all([
      this.repo.findCachedByQuery(tenantHost, query),
      this.searchCommonFoods(query),
    ]);

    const cachedKeys = new Set(
      cachedRows.map((row) => `${row.source}::${row.source_ref}`)
    );
    // Seed foods this tenant has not cached yet.
    const freshSeed = seedResults.filter(
      (r) => cachedKeys.has(`seed::${r.sourceRef}`) === false
    );

    let freshSource: FoodResult[] = [];

    // A brand filter always queries the source: the brand's catalogue lives in
    // OFF, not the local cache, so the usual "enough local results" short-circuit
    // would hide most of it.
    if (hasBrand || cachedRows.length + freshSeed.length < MIN_LOCAL_RESULTS) {
      freshSource = (
        await this.searchSource(query, locale, country, brand)
      ).filter(
        (r) =>
          r.sourceRef === null ||
          cachedKeys.has(`${r.source}::${r.sourceRef}`) === false
      );
    }

    // Persist fresh hits and surface them as cache rows so they carry ids.
    const insertedRows = await this.repo.insertResolved(tenantHost, [
      ...freshSeed,
      ...freshSource,
    ]);

    const merged = [
      ...cachedRows.map(rowToFoodResult),
      ...insertedRows.map(rowToFoodResult),
    ];
    // When a brand is requested, drop anything that doesn't match it — cached
    // rows and seed foods are name-matched only and would otherwise leak in.
    const filtered = hasBrand
      ? merged.filter((r) => brandMatches(r, brand))
      : merged;

    return rankResults(query, filtered);
  }

  /** Cache-first lookup by barcode (OFF product code). */
  async getByBarcode(
    tenantHost: string,
    code: string
  ): Promise<FoodResult | null> {
    return this.lookupByRef(tenantHost, code, (c) =>
      this.source.getByBarcode(c)
    );
  }

  /** Cache-first lookup by source ref (for OFF, the product code). */
  async getByRef(tenantHost: string, code: string): Promise<FoodResult | null> {
    return this.lookupByRef(tenantHost, code, (c) => this.source.getByRef(c));
  }

  /**
   * Lazily fill an OFF-backed cache row's serving data (label + weight) from
   * the v2 product API — the search index doesn't carry serving fields, so
   * they're hydrated once, when a trainer actually selects the food. Rows
   * already checked (any serving column set, including an explicit
   * empty-string marker for "OFF has nothing") are returned as-is with no
   * network call, which keeps us far under OFF's 15 req/min product limit.
   * A source failure degrades to the cached row unchanged.
   */
  async enrichServing(
    tenantHost: string,
    ingredientId: string
  ): Promise<FoodResult | null> {
    const row = await this.repo.findById(tenantHost, ingredientId);

    if (row === null) {
      return null;
    }

    const alreadyChecked =
      row.serving_size !== null ||
      row.serving_quantity !== null ||
      row.serving_quantity_unit !== null;

    if (
      row.source !== "off" ||
      row.source_ref === null ||
      alreadyChecked === true
    ) {
      return rowToFoodResult(row);
    }

    let fresh: FoodResult | null = null;

    try {
      fresh = await this.source.getByRef(row.source_ref);
    } catch (error) {
      console.warn("[FoodLookupService] serving enrichment failed:", {
        error: error instanceof Error ? error.message : String(error),
      });

      return rowToFoodResult(row);
    }

    // Mark the row as checked even when OFF has no serving data (unit set,
    // quantity/size null) so the next selection doesn't re-hit the API.
    const updated = await this.repo.updateServing(tenantHost, ingredientId, {
      serving_size: fresh?.servingSize ?? null,
      serving_quantity: fresh?.servingQuantity ?? null,
      serving_quantity_unit:
        fresh?.servingQuantityUnit ??
        (fresh?.servingQuantity !== undefined ? "g" : "none"),
    });

    return rowToFoodResult(updated ?? row);
  }

  /** Create a manual ingredient, persist it, and return the mapped result. */
  async createManual(
    tenantHost: string,
    input: ManualIngredientInput
  ): Promise<FoodResult> {
    const row = await this.repo.insertManual(tenantHost, input);

    return rowToFoodResult(row);
  }

  /** Seed lookup that tolerates an unapplied migration / read failure. */
  private async searchCommonFoods(query: string): Promise<FoodResult[]> {
    if (this.commonFoods === null) {
      return [];
    }

    try {
      return await this.commonFoods.search(query);
    } catch (error) {
      console.warn("[FoodLookupService] common_foods search failed:", {
        error: error instanceof Error ? error.message : String(error),
      });

      return [];
    }
  }

  /** External search that degrades to [] on failure instead of erroring out. */
  private async searchSource(
    query: string,
    locale?: string,
    country?: string,
    brand?: string
  ): Promise<FoodResult[]> {
    try {
      return await this.source.search(query, locale, country, brand);
    } catch (error) {
      console.warn("[FoodLookupService] external food search failed:", {
        error: error instanceof Error ? error.message : String(error),
      });

      return [];
    }
  }

  private async lookupByRef(
    tenantHost: string,
    code: string,
    fetchFromSource: (code: string) => Promise<FoodResult | null>
  ): Promise<FoodResult | null> {
    // Barcodes/refs are an OFF concept, so the cache lookup uses source 'off'.
    const cached = await this.repo.findCachedByRef(tenantHost, "off", code);

    if (cached !== null) {
      return rowToFoodResult(cached);
    }

    const result = await fetchFromSource(code);

    if (result === null) {
      return null;
    }

    const inserted = await this.repo.insertResolved(tenantHost, [result]);
    const row = inserted[0];

    // Prefer the cache row (it carries the id); fall back to the raw result.
    return row !== undefined ? rowToFoodResult(row) : result;
  }
}

/** Case-insensitive brand match; results without a brand never match. */
function brandMatches(result: FoodResult, brand: string): boolean {
  if (result.brand === undefined) {
    return false;
  }

  return result.brand.toLowerCase().includes(brand.toLowerCase());
}

/**
 * Order results by how well the name matches the query: exact > prefix >
 * substring; ties prefer seed foods (raw staples) and shorter names. Also
 * dedupes by cache row id.
 */
function rankResults(query: string, results: FoodResult[]): FoodResult[] {
  const q = normalizeFoodQuery(query);
  const seen = new Set<string>();
  const deduped: FoodResult[] = [];

  for (const r of results) {
    const key = r.id ?? `${r.source}::${r.sourceRef}::${r.name}`;

    if (seen.has(key) === false) {
      seen.add(key);
      deduped.push(r);
    }
  }

  const tier = (r: FoodResult): number => {
    const name = normalizeFoodQuery(r.name);

    if (name === q) {
      return 0;
    }

    if (name.startsWith(q)) {
      return 1;
    }

    return 2;
  };

  return deduped.sort((a, b) => {
    const byTier = tier(a) - tier(b);

    if (byTier !== 0) {
      return byTier;
    }

    const aSeed = a.source === "seed" ? 0 : 1;
    const bSeed = b.source === "seed" ? 0 : 1;

    if (aSeed !== bSeed) {
      return aSeed - bSeed;
    }

    return a.name.length - b.name.length;
  });
}
