import { describe, expect, it } from "vitest";

import { loggedDates, mondayOf } from "../meal-cycle-week-helpers";

describe("mondayOf", () => {
  it("returns the same date when it is already a Monday", () => {
    expect(mondayOf("2026-06-08")).toBe("2026-06-08");
  });

  it("snaps a mid-week date back to its Monday", () => {
    expect(mondayOf("2026-06-10")).toBe("2026-06-08"); // Wednesday
  });

  it("snaps Sunday back to that week's Monday (not forward)", () => {
    expect(mondayOf("2026-06-14")).toBe("2026-06-08");
  });

  it("crosses a month boundary", () => {
    expect(mondayOf("2026-07-01")).toBe("2026-06-29"); // Wed → Mon June 29
  });
});

describe("loggedDates", () => {
  it("collects only dates that have ≥1 log", () => {
    const set = loggedDates([
      { date: "2026-06-08", logs: {} },
      { date: "2026-06-09", logs: { "slot-1": {} } },
      { date: "2026-06-10", logs: { "slot-1": {}, "slot-2": {} } },
    ]);

    expect([...set].sort()).toEqual(["2026-06-09", "2026-06-10"]);
  });

  it("is empty when no day has logs", () => {
    expect(loggedDates([{ date: "2026-06-08", logs: {} }]).size).toBe(0);
  });
});
