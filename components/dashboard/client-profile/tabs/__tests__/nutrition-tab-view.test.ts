import { describe, expect, it } from "vitest";

import { resolveNutritionTabView } from "../nutrition-tab-view";

describe("resolveNutritionTabView (trainer-tools flag drives the tab)", () => {
  it("shows a loading state while the flag is resolving", () => {
    expect(resolveNutritionTabView(false, true)).toBe("loading");
    expect(resolveNutritionTabView(true, true)).toBe("loading");
  });

  it("renders the cycle builder when the TRAINER tools are enabled (prepare phase included)", () => {
    expect(resolveNutritionTabView(true, false)).toBe("cycle-builder");
  });

  it("renders the legacy nutrition tab when the trainer tools are disabled", () => {
    expect(resolveNutritionTabView(false, false)).toBe("legacy");
  });
});
