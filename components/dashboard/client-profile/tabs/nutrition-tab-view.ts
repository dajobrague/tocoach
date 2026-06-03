/** Which view the Nutrición tab should render, given the nutrition-v2 flag. */
export type NutritionTabView = "loading" | "cycle-builder" | "legacy";

/**
 * Pure decision for the Nutrición tab: while the flag is resolving show a
 * loading state; once resolved, the new cycle builder when enabled, otherwise
 * the unchanged legacy tab. Kept pure so the flag-on/off switch is unit-tested
 * without rendering the heavy builder.
 */
export function resolveNutritionTabView(
  enabled: boolean,
  isLoading: boolean
): NutritionTabView {
  if (isLoading) {
    return "loading";
  }

  return enabled ? "cycle-builder" : "legacy";
}
