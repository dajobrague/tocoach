import { describe, expect, it } from "vitest";

import { resolveClientVerdict } from "../readiness-service";

describe("resolveClientVerdict (delivery-ladder precedence)", () => {
  it("an active v2 plan beats everything", () => {
    expect(
      resolveClientVerdict({
        hasActiveV2Plan: true,
        hasPdf: true,
        hasGoals: true,
        hasStructuredV1Plan: true,
      })
    ).toBe("plan_v2");
  });

  it("a PDF beats goals and the legacy structured plan", () => {
    expect(
      resolveClientVerdict({
        hasActiveV2Plan: false,
        hasPdf: true,
        hasGoals: true,
        hasStructuredV1Plan: true,
      })
    ).toBe("pdf");
  });

  it("goals cover a client with no plan and no PDF", () => {
    expect(
      resolveClientVerdict({
        hasActiveV2Plan: false,
        hasPdf: false,
        hasGoals: true,
        hasStructuredV1Plan: true,
      })
    ).toBe("goals");
  });

  it("flags at_risk ONLY when a structured legacy plan would go dark", () => {
    expect(
      resolveClientVerdict({
        hasActiveV2Plan: false,
        hasPdf: false,
        hasGoals: false,
        hasStructuredV1Plan: true,
      })
    ).toBe("at_risk");
  });

  it("nothing anywhere is the neutral empty state, not a warning", () => {
    expect(
      resolveClientVerdict({
        hasActiveV2Plan: false,
        hasPdf: false,
        hasGoals: false,
        hasStructuredV1Plan: false,
      })
    ).toBe("none");
  });
});
