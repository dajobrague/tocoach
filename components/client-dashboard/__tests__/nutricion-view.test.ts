import { describe, expect, it } from "vitest";

import { resolveClientNutritionView } from "../nutricion-view";

describe("resolveClientNutritionView", () => {
  it("renders the meal-cycle plan view when nutrition_v2 is enabled", () => {
    expect(resolveClientNutritionView(true)).toBe("meal-cycle");
  });

  it("renders the legacy nutrition view when nutrition_v2 is off", () => {
    expect(resolveClientNutritionView(false)).toBe("legacy");
  });
});
