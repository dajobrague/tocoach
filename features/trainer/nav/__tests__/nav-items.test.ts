import { describe, expect, it } from "vitest";

import { filterTrainerNav, flattenLeaves, TRAINER_NAV } from "../nav-items";

function leafKeys(sections = TRAINER_NAV): string[] {
  return flattenLeaves(sections).map((item) => item.key);
}

describe("filterTrainerNav", () => {
  it("hides nutrition_v2-gated items when the flag is off", () => {
    const filtered = filterTrainerNav(TRAINER_NAV, { nutritionV2: false });

    expect(leafKeys(filtered)).not.toContain("recipes");
    // Non-gated items are untouched.
    expect(leafKeys(filtered)).toContain("exercise-library");
    expect(leafKeys(filtered)).toContain("metricas");
  });

  it("shows nutrition_v2-gated items when the flag is on", () => {
    const filtered = filterTrainerNav(TRAINER_NAV, { nutritionV2: true });

    expect(leafKeys(filtered)).toContain("recipes");
  });

  it("does not mutate the source nav", () => {
    filterTrainerNav(TRAINER_NAV, { nutritionV2: false });

    expect(leafKeys(TRAINER_NAV)).toContain("recipes");
  });
});
