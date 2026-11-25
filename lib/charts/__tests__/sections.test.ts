import { describe, expect, it } from "vitest";

import { chartSections, sectionOf } from "../sections";
import { buildStarterDocument } from "../starter";
import { chartConfigSchema } from "../validation";

describe("chart sections", () => {
  it("no tabs when nothing is sectioned", () => {
    expect(chartSections([{}, { section: "  " }])).toEqual([]);
  });

  it("tabs in first-appearance order, unsectioned under General", () => {
    expect(
      chartSections([
        { section: "Medidas" },
        {},
        { section: "Energía" },
        { section: " Medidas " },
      ])
    ).toEqual(["Medidas", "General", "Energía"]);
    expect(sectionOf({})).toBe("General");
  });

  it("the schema keeps the section (zod would strip an unknown key)", () => {
    const chart = buildStarterDocument().charts[0];
    const parsed = chartConfigSchema.safeParse({
      ...chart,
      section: " Medidas ",
    });

    expect(chart).toBeDefined();
    expect(parsed.success && parsed.data.section).toBe("Medidas");
  });
});
