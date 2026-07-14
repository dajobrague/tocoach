import { describe, expect, it } from "vitest";

import {
  formatGrams,
  formatKcal,
  recipeMacroSummary,
  statusColor,
  statusLabel,
  toNumber,
} from "../recipe-format";

describe("toNumber", () => {
  it("coerces numbers and numeric strings", () => {
    expect(toNumber(12.5)).toBe(12.5);
    expect(toNumber("12.5")).toBe(12.5);
  });

  it("returns 0 for non-finite / missing / garbage", () => {
    expect(toNumber(undefined)).toBe(0);
    expect(toNumber(null)).toBe(0);
    expect(toNumber(NaN)).toBe(0);
    expect(toNumber("abc")).toBe(0);
  });
});

describe("formatKcal / formatGrams", () => {
  it("rounds kcal to a whole number", () => {
    expect(formatKcal(388.6)).toBe("389 kcal");
    expect(formatKcal("145.875")).toBe("146 kcal");
  });

  it("rounds grams to one decimal", () => {
    expect(formatGrams(16.94)).toBe("16.9 g");
    expect(formatGrams(5)).toBe("5 g");
    expect(formatGrams(undefined)).toBe("0 g");
  });
});

describe("recipeMacroSummary", () => {
  it("formats all four macros", () => {
    expect(
      recipeMacroSummary({
        kcal: 389,
        protein_g: 16.9,
        carbs_g: 66.3,
        fat_g: 6.9,
      })
    ).toEqual({
      kcal: "389 kcal",
      protein: "16.9 g",
      carbs: "66.3 g",
      fat: "6.9 g",
    });
  });
});

describe("statusLabel / statusColor", () => {
  it("labels known statuses in Spanish and falls back to the raw value", () => {
    expect(statusLabel("active")).toBe("Activa");
    expect(statusLabel("draft")).toBe("Borrador");
    expect(statusLabel("archived")).toBe("Archivada");
    expect(statusLabel("weird")).toBe("weird");
  });

  it("maps statuses to chip colors", () => {
    expect(statusColor("active")).toBe("success");
    expect(statusColor("draft")).toBe("warning");
    expect(statusColor("archived")).toBe("default");
  });
});
