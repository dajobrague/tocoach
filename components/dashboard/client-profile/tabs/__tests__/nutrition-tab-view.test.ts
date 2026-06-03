import { describe, expect, it } from "vitest";

import { resolveNutritionTabView } from "../nutrition-tab-view";

describe("resolveNutritionTabView (flag-on vs flag-off tab switch)", () => {
  it("shows a loading state while the flag is resolving", () => {
    expect(resolveNutritionTabView(false, true)).toBe("loading");
    expect(resolveNutritionTabView(true, true)).toBe("loading");
  });

  it("renders the new cycle builder when the flag is enabled", () => {
    expect(resolveNutritionTabView(true, false)).toBe("cycle-builder");
  });

  it("renders the legacy nutrition tab when the flag is disabled", () => {
    expect(resolveNutritionTabView(false, false)).toBe("legacy");
  });
});
