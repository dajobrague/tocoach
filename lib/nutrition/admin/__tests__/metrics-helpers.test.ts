import { describe, expect, it } from "vitest";

import {
  bucketLogsByWeek,
  intersectionCount,
  mondayOf,
  recipeCountDistribution,
  roundedAverage,
  tallyBy,
  weekStartsForRange,
} from "../metrics-helpers";

/**
 * Pure shaping/bucketing for the admin nutrition-v2 success metrics. No DB —
 * the query layer fetches flat rows and delegates all week-bucketing,
 * distribution and averaging here so the math is unit-tested directly
 * (no-jsdom convention).
 */

describe("mondayOf — ISO week start (UTC Monday)", () => {
  it("returns the same date when it is already a Monday", () => {
    expect(mondayOf("2026-06-01")).toBe("2026-06-01"); // a Monday
  });

  it("snaps a mid-week date back to its Monday", () => {
    expect(mondayOf("2026-06-03")).toBe("2026-06-01"); // Wednesday → Monday
  });

  it("snaps Sunday back to the week's Monday (not forward)", () => {
    expect(mondayOf("2026-06-07")).toBe("2026-06-01"); // Sunday → that Monday
  });
});

describe("weekStartsForRange — last N Mondays, oldest→newest", () => {
  it("ends with the anchor's week and walks back N weeks", () => {
    expect(weekStartsForRange("2026-06-03", 3)).toEqual([
      "2026-05-18",
      "2026-05-25",
      "2026-06-01",
    ]);
  });

  it("returns a single week for N=1", () => {
    expect(weekStartsForRange("2026-06-03", 1)).toEqual(["2026-06-01"]);
  });
});

describe("bucketLogsByWeek — logs + distinct clients per week", () => {
  const weeks = weekStartsForRange("2026-06-03", 3); // 05-18, 05-25, 06-01

  it("counts logs and distinct clients into the right week", () => {
    const rows = [
      { log_date: "2026-06-01", client_id: 1 }, // week 06-01
      { log_date: "2026-06-02", client_id: 1 }, // week 06-01 (same client)
      { log_date: "2026-06-03", client_id: 2 }, // week 06-01
      { log_date: "2026-05-26", client_id: 3 }, // week 05-25
    ];

    expect(bucketLogsByWeek(rows, weeks)).toEqual([
      { weekStart: "2026-05-18", logs: 0, distinctClients: 0 },
      { weekStart: "2026-05-25", logs: 1, distinctClients: 1 },
      { weekStart: "2026-06-01", logs: 3, distinctClients: 2 },
    ]);
  });

  it("drops rows outside the requested window", () => {
    const rows = [
      { log_date: "2026-01-01", client_id: 9 }, // way before the window
      { log_date: "2026-06-01", client_id: 1 },
    ];

    const result = bucketLogsByWeek(rows, weeks);

    expect(result.reduce((sum, w) => sum + w.logs, 0)).toBe(1);
  });

  it("returns an all-zero series for no rows", () => {
    expect(bucketLogsByWeek([], weeks)).toEqual([
      { weekStart: "2026-05-18", logs: 0, distinctClients: 0 },
      { weekStart: "2026-05-25", logs: 0, distinctClients: 0 },
      { weekStart: "2026-06-01", logs: 0, distinctClients: 0 },
    ]);
  });
});

describe("tallyBy — per-key occurrence counts", () => {
  it("counts rows per trainer id, skipping null keys", () => {
    const rows = [
      { trainer_id: "a" },
      { trainer_id: "a" },
      { trainer_id: "b" },
      { trainer_id: null },
    ];
    const tally = tallyBy(rows, (row) => row.trainer_id);

    expect(tally.get("a")).toBe(2);
    expect(tally.get("b")).toBe(1);
    expect(tally.size).toBe(2);
  });
});

describe("intersectionCount — enabled trainers actually using it", () => {
  it("counts members of `enabled` present in `using`", () => {
    expect(intersectionCount(["a", "b", "c"], ["b", "c", "z"])).toBe(2);
  });

  it("is 0 with no overlap", () => {
    expect(intersectionCount(["a"], ["b"])).toBe(0);
  });
});

describe("recipeCountDistribution — buckets active trainers", () => {
  it("buckets counts into 1–5 / 6–20 / 21+ and ignores non-active (0)", () => {
    expect(recipeCountDistribution([1, 5, 6, 20, 21, 99, 0])).toEqual([
      { label: "1–5", trainers: 2 },
      { label: "6–20", trainers: 2 },
      { label: "21+", trainers: 2 },
    ]);
  });
});

describe("roundedAverage — 1-decimal mean, divide-by-zero safe", () => {
  it("rounds to one decimal", () => {
    expect(roundedAverage(10, 3)).toBe(3.3);
  });

  it("returns 0 when the divisor is 0", () => {
    expect(roundedAverage(10, 0)).toBe(0);
  });
});
