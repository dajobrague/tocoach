import { describe, expect, it } from "vitest";

import { basalMetabolicRate, isValidBmrInput } from "../bmr";

describe("basalMetabolicRate", () => {
  it("computes Mifflin-St Jeor for men (+5)", () => {
    // 10*80 + 6.25*180 - 5*30 + 5 = 800 + 1125 - 150 + 5
    expect(
      basalMetabolicRate({
        sex: "male",
        weightKg: 80,
        heightCm: 180,
        ageYears: 30,
      })
    ).toBe(1780);
  });

  it("computes Mifflin-St Jeor for women (-161)", () => {
    // 10*60 + 6.25*165 - 5*28 - 161 = 600 + 1031.25 - 140 - 161
    expect(
      basalMetabolicRate({
        sex: "female",
        weightKg: 60,
        heightCm: 165,
        ageYears: 28,
      })
    ).toBe(1330);
  });

  it("rounds to integer kcal (no decimals)", () => {
    const result = basalMetabolicRate({
      sex: "female",
      weightKg: 61.3,
      heightCm: 164.5,
      ageYears: 27,
    });

    expect(Number.isInteger(result)).toBe(true);
  });
});

describe("isValidBmrInput", () => {
  const base = {
    sex: "male" as const,
    weightKg: 80,
    heightCm: 180,
    ageYears: 30,
  };

  it("accepts a normal adult profile", () => {
    expect(isValidBmrInput(base)).toBe(true);
  });

  it("rejects missing sex and out-of-range values", () => {
    expect(isValidBmrInput({ ...base, sex: null })).toBe(false);
    expect(isValidBmrInput({ ...base, weightKg: 800 })).toBe(false);
    expect(isValidBmrInput({ ...base, heightCm: 20 })).toBe(false);
    expect(isValidBmrInput({ ...base, ageYears: 5 })).toBe(false);
    expect(isValidBmrInput({ ...base, weightKg: NaN })).toBe(false);
  });
});
