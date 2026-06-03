import { describe, expect, it } from "vitest";

import { ADHERENCE_METRICS, adherenceDateRange } from "../adherence-format";

describe("adherenceDateRange", () => {
  it("'this-week' is the 7 days ending today (inclusive)", () => {
    expect(adherenceDateRange("this-week", "2026-06-10")).toEqual({
      from: "2026-06-04",
      to: "2026-06-10",
    });
  });

  it("'last-4-weeks' is the 28 days ending today (inclusive)", () => {
    expect(adherenceDateRange("last-4-weeks", "2026-06-28")).toEqual({
      from: "2026-06-01",
      to: "2026-06-28",
    });
  });

  it("steps across month boundaries correctly", () => {
    expect(adherenceDateRange("this-week", "2026-07-02")).toEqual({
      from: "2026-06-26",
      to: "2026-07-02",
    });
  });
});

describe("ADHERENCE_METRICS", () => {
  it("describes the two metrics distinctly (engagement vs adherence)", () => {
    expect(ADHERENCE_METRICS.engagement.key).toBe("engagementPct");
    expect(ADHERENCE_METRICS.adherence.key).toBe("adherencePct");
    // Distinct labels + colors so a coach can't conflate them.
    expect(ADHERENCE_METRICS.engagement.label).not.toBe(
      ADHERENCE_METRICS.adherence.label
    );
    expect(ADHERENCE_METRICS.engagement.color).not.toBe(
      ADHERENCE_METRICS.adherence.color
    );
  });
});
