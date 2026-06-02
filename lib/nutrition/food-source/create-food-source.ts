import type { FoodSource } from "./types";

import { OpenFoodFactsSource } from "./open-food-facts-source";

/**
 * Single swap point for food providers. Reads `NUTRITION_FOOD_SOURCE`
 * (default "off"). Only Open Food Facts exists today; future providers are
 * registered here so the rest of the app depends on the {@link FoodSource}
 * interface, never a concrete provider.
 */
export function createFoodSource(): FoodSource {
  const which = process.env.NUTRITION_FOOD_SOURCE ?? "off";

  switch (which) {
    case "off":
      return new OpenFoodFactsSource();
    default:
      throw new Error(`Unknown NUTRITION_FOOD_SOURCE: "${which}"`);
  }
}
