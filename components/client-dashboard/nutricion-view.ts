/** Which client Nutrición view to render, given the nutrition-v2 flag. */
export type ClientNutritionView = "meal-cycle" | "legacy";

/**
 * Pure decision for the client's `/[slug]/nutricion` route: the new meal-cycle
 * plan view when nutrition_v2 is enabled for the tenant, otherwise the existing
 * legacy nutrition view. Kept pure so the flag-on/off branch is unit-tested
 * without rendering either (heavy) view; the page resolves the flag server-side
 * and calls this.
 */
export function resolveClientNutritionView(
  enabled: boolean
): ClientNutritionView {
  return enabled ? "meal-cycle" : "legacy";
}
