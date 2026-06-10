import { describe, it, expect } from "vitest";

import { resolveRestLabel } from "./rest-label";

// Scenario: rest can live in two places depending on which trainer flow
// wrote it. The template editor parses numeric input into the
// `rest_seconds` column; the client-page add/edit flow stores the raw
// text in `metadata.rest_description` only. The client app must show
// the rest no matter which path wrote it.
describe("resolveRestLabel — split rest storage (rest_description vs rest_seconds)", () => {
  describe("description-only rows (client-page add/edit flow)", () => {
    it("shows the raw description when rest_seconds is null", () => {
      expect(resolveRestLabel("120s", null)).toBe("120s");
    });

    it("shows free-text descriptions verbatim", () => {
      expect(
        resolveRestLabel(
          "El necesario para afrontar la serie pero sin distracciones",
          null
        )
      ).toBe("El necesario para afrontar la serie pero sin distracciones");
    });

    it("trims surrounding whitespace", () => {
      expect(resolveRestLabel("  90s  ", null)).toBe("90s");
    });
  });

  describe("seconds-only rows (template editor flow)", () => {
    it("formats rest_seconds as Ns when there is no description", () => {
      expect(resolveRestLabel(null, 90)).toBe("90s");
    });

    it("rounds fractional seconds", () => {
      expect(resolveRestLabel(undefined, 89.6)).toBe("90s");
    });
  });

  describe("precedence and empties", () => {
    it("prefers the description over rest_seconds (matches resolveStrengthCoachingFields)", () => {
      expect(resolveRestLabel("1min 30s", 90)).toBe("1min 30s");
    });

    it("falls back to rest_seconds when the description is whitespace-only", () => {
      expect(resolveRestLabel("   ", 60)).toBe("60s");
    });

    it("returns empty when neither is set", () => {
      expect(resolveRestLabel(null, null)).toBe("");
      expect(resolveRestLabel(undefined, undefined)).toBe("");
    });

    it("treats 0 and negative seconds as unset", () => {
      expect(resolveRestLabel(null, 0)).toBe("");
      expect(resolveRestLabel(null, -5)).toBe("");
    });
  });
});
