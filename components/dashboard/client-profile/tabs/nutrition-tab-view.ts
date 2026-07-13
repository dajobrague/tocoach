/** Which view the Nutrición tab should render, given the nutrition-v2 flags. */
export type NutritionTabView = "loading" | "cycle-builder" | "legacy";

/**
 * Pure decision for the Nutrición tab: while the flags resolve show a loading
 * state; once resolved, the v2 cycle builder when the TRAINER tools are
 * enabled (prepare phase included — clients may still be on legacy), the
 * unchanged legacy tab otherwise. Kept pure so the switch is unit-tested
 * without rendering the heavy builder.
 */
export function resolveNutritionTabView(
  trainerEnabled: boolean,
  isLoading: boolean
): NutritionTabView {
  if (isLoading) {
    return "loading";
  }

  return trainerEnabled ? "cycle-builder" : "legacy";
}
