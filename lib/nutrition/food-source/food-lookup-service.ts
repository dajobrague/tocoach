import type {
  IngredientRepository,
  ManualIngredientInput,
} from "./ingredient-repository";
import type { FoodResult, FoodSource } from "./types";

import { rowToFoodResult } from "./ingredient-repository";

export interface FoodLookupServiceDeps {
  repo: IngredientRepository;
  source: FoodSource;
}

/**
 * Cache-first food lookup. Reads the tenant's ingredient cache before touching
 * the external {@link FoodSource}, and persists source results so repeat
 * lookups are local hits (nutrition-v2 invariant §4.5: switching the food
 * source never mutates already-cached ingredients).
 *
 * Every method takes `tenantHost` explicitly — tenant scoping is never implicit.
 */
export class FoodLookupService {
  private readonly repo: IngredientRepository;
  private readonly source: FoodSource;

  constructor(deps: FoodLookupServiceDeps) {
    this.repo = deps.repo;
    this.source = deps.source;
  }

  /**
   * Cache-first search. If any cached ingredient matches the query for this
   * tenant, those rows are mapped and returned WITHOUT calling the source. On a
   * miss, the source is queried, its results are persisted, and returned.
   * (A force-refresh path can be added later.)
   */
  async search(
    tenantHost: string,
    query: string,
    locale?: string
  ): Promise<FoodResult[]> {
    const cached = await this.repo.findCachedByQuery(tenantHost, query);

    if (cached.length > 0) {
      return cached.map(rowToFoodResult);
    }

    const results = await this.source.search(query, locale);

    await this.repo.insertResolved(tenantHost, results);

    return results;
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

  /** Create a manual ingredient, persist it, and return the mapped result. */
  async createManual(
    tenantHost: string,
    input: ManualIngredientInput
  ): Promise<FoodResult> {
    const row = await this.repo.insertManual(tenantHost, input);

    return rowToFoodResult(row);
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

    await this.repo.insertResolved(tenantHost, [result]);

    return result;
  }
}
