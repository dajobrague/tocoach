import { describe, expect, it } from "vitest";

import { resolveMarket } from "../market";

describe("resolveMarket", () => {
  it("returns the configured market as a lowercased slug", () => {
    expect(resolveMarket({ food_market: "Spain" })).toBe("spain");
  });

  it("trims surrounding whitespace", () => {
    expect(resolveMarket({ food_market: "  mexico  " })).toBe("mexico");
  });

  it("defaults to Spain when no market is configured", () => {
    expect(resolveMarket({})).toBe("spain");
  });

  it("defaults to Spain for a blank market", () => {
    expect(resolveMarket({ food_market: "   " })).toBe("spain");
  });

  it("defaults to Spain for a non-string market", () => {
    expect(resolveMarket({ food_market: 42 })).toBe("spain");
  });

  it("defaults to Spain for a null/undefined features object", () => {
    expect(resolveMarket(null)).toBe("spain");
    expect(resolveMarket(undefined)).toBe("spain");
  });
});
