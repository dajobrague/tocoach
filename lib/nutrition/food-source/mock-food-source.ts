import type { FoodResult, FoodSource } from "./types";

/** Canned responses for a {@link MockFoodSource}. All fields optional. */
export interface MockFoodSourceConfig {
  searchResults?: FoodResult[];
  byRef?: Record<string, FoodResult>;
  byBarcode?: Record<string, FoodResult>;
}

/**
 * In-memory {@link FoodSource} test double. Returns only what it is configured
 * with — no network, no fuzzy matching — so service tests can assert exact
 * behavior. Configure via the constructor or the `set*` helpers.
 */
export class MockFoodSource implements FoodSource {
  private searchResults: FoodResult[];
  private readonly byRef: Map<string, FoodResult>;
  private readonly byBarcode: Map<string, FoodResult>;

  constructor(config: MockFoodSourceConfig = {}) {
    this.searchResults = config.searchResults ?? [];
    this.byRef = new Map(Object.entries(config.byRef ?? {}));
    this.byBarcode = new Map(Object.entries(config.byBarcode ?? {}));
  }

  setSearchResults(results: FoodResult[]): void {
    this.searchResults = results;
  }

  setByRef(sourceRef: string, result: FoodResult): void {
    this.byRef.set(sourceRef, result);
  }

  setByBarcode(code: string, result: FoodResult): void {
    this.byBarcode.set(code, result);
  }

  async search(
    _query: string,
    _locale?: string,
    _country?: string,
    _brand?: string
  ): Promise<FoodResult[]> {
    return this.searchResults;
  }

  async getByRef(sourceRef: string): Promise<FoodResult | null> {
    return this.byRef.get(sourceRef) ?? null;
  }

  async getByBarcode(code: string): Promise<FoodResult | null> {
    return this.byBarcode.get(code) ?? null;
  }
}
