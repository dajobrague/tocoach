import { describe, expect, it } from "vitest";

import {
  isRecipeUnit,
  normalizeUnit,
  RECIPE_UNITS,
  toGrams,
} from "../unit-conversion";

describe("isRecipeUnit", () => {
  it("accepts the four supported units", () => {
    for (const unit of RECIPE_UNITS) {
      expect(isRecipeUnit(unit)).toBe(true);
    }
  });

  it("rejects anything else", () => {
    for (const value of ["G", "kg", "piece", "", null, undefined, 5]) {
      expect(isRecipeUnit(value)).toBe(false);
    }
  });
});

describe("normalizeUnit", () => {
  it("passes through supported units", () => {
    expect(normalizeUnit("ml")).toBe("ml");
  });

  it("falls back to grams for unknown/missing units", () => {
    expect(normalizeUnit("kg")).toBe("g");
    expect(normalizeUnit(null)).toBe("g");
    expect(normalizeUnit(undefined)).toBe("g");
  });
});

describe("toGrams", () => {
  it("treats grams 1:1", () => {
    expect(toGrams(150, "g")).toBe(150);
  });

  it("treats millilitres as grams (density 1)", () => {
    expect(toGrams(250, "ml")).toBe(250);
  });

  it("converts litres to grams (×1000)", () => {
    expect(toGrams(1.5, "lt")).toBe(1500);
  });

  it("multiplies pieces by grams-per-unit", () => {
    expect(toGrams(2, "u", 60)).toBe(120);
  });

  it("contributes 0 grams for pieces without a grams-per-unit", () => {
    expect(toGrams(3, "u")).toBe(0);
    expect(toGrams(3, "u", undefined)).toBe(0);
    expect(toGrams(3, "u", "not-a-number")).toBe(0);
  });

  it("defaults an unknown unit to grams", () => {
    expect(toGrams(80, "kg")).toBe(80);
    expect(toGrams(80, null)).toBe(80);
  });

  it("degrades non-finite quantities to 0 instead of NaN", () => {
    expect(toGrams(NaN, "g")).toBe(0);
    expect(toGrams("abc", "ml")).toBe(0);
    expect(toGrams(undefined, "lt")).toBe(0);
    expect(Number.isNaN(toGrams(Infinity, "u", 10))).toBe(false);
  });

  it("handles fractional gram-per-piece weights", () => {
    expect(toGrams(3, "u", 12.5)).toBe(37.5);
  });
});
