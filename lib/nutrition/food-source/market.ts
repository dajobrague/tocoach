/**
 * Platform default market. TopCoach serves Spanish trainers exclusively, so
 * food search must never surface products from other countries. A tenant that
 * hasn't configured a market falls back to Spain rather than a world search.
 */
export const DEFAULT_MARKET = "spain";

/**
 * Resolve a tenant's food-search market from its `features` JSONB.
 *
 * The market is an Open Food Facts country slug (e.g. "spain", "mexico") used
 * to scope search results via `countries_tags`. It is configured per tenant at
 * `features.food_market`; when unset or malformed, it defaults to
 * {@link DEFAULT_MARKET} (Spain). A tenant can still opt into a different
 * market by setting `features.food_market` explicitly.
 */
export function resolveMarket(features: unknown): string {
  if (typeof features !== "object" || features === null) {
    return DEFAULT_MARKET;
  }

  const value = (features as Record<string, unknown>)["food_market"];

  if (typeof value !== "string") {
    return DEFAULT_MARKET;
  }

  const slug = value.trim().toLowerCase();

  return slug.length > 0 ? slug : DEFAULT_MARKET;
}
