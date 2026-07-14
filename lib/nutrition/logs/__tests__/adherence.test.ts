import { describe, expect, it } from "vitest";

import { buildPlannedDays, computeAdherence } from "../adherence";

/** Build a contiguous planned-day list, all with the same planned count. */
function plannedRange(from: string, count: number, planned: number) {
  const [y, m, d] = from.split("-").map(Number);
  const start = Date.UTC(y!, m! - 1, d!);

  return Array.from({ length: count }, (_, i) => {
    const date = new Date(start + i * 86_400_000).toISOString().slice(0, 10);

    return { date, planned };
  });
}

describe("computeAdherence", () => {
  it("reports zero engagement and adherence when there are no logs", () => {
    const report = computeAdherence(plannedRange("2026-06-01", 3, 2), []);

    expect(report.totals).toEqual({
      planned: 6,
      logged: 0,
      engagementPct: 0,
      adherencePct: 0,
    });
    expect(report.statusBreakdown).toEqual({
      eaten_planned: 0,
      eaten_other: 0,
      skipped: 0,
    });
    expect(
      report.days.every((d) => d.engagementPct === 0 && d.adherencePct === 0)
    ).toBe(true);
  });

  it("all-skipped → 100% engagement but 0% adherence", () => {
    const days = plannedRange("2026-06-01", 2, 1); // 2 days, 1 slot each
    const report = computeAdherence(days, [
      { logDate: "2026-06-01", status: "skipped" },
      { logDate: "2026-06-02", status: "skipped" },
    ]);

    expect(report.totals).toEqual({
      planned: 2,
      logged: 2,
      engagementPct: 100,
      adherencePct: 0,
    });
    expect(report.statusBreakdown.skipped).toBe(2);
    expect(report.statusBreakdown.eaten_planned).toBe(0);
  });

  it("all-eaten_planned → 100% engagement and 100% adherence", () => {
    const days = plannedRange("2026-06-01", 2, 1);
    const report = computeAdherence(days, [
      { logDate: "2026-06-01", status: "eaten_planned" },
      { logDate: "2026-06-02", status: "eaten_planned" },
    ]);

    expect(report.totals).toEqual({
      planned: 2,
      logged: 2,
      engagementPct: 100,
      adherencePct: 100,
    });
  });

  it("a mix (1 planned-eaten + 1 other + 1 skipped of 3 planned) → engagement 100 / adherence 33", () => {
    const report = computeAdherence(
      [{ date: "2026-06-01", planned: 3 }],
      [
        { logDate: "2026-06-01", status: "eaten_planned" },
        { logDate: "2026-06-01", status: "eaten_other" },
        { logDate: "2026-06-01", status: "skipped" },
      ]
    );

    expect(report.days[0]).toEqual({
      date: "2026-06-01",
      planned: 3,
      logged: 3,
      engagementPct: 100, // 3 logged / 3 planned
      adherencePct: 33, // 1 eaten_planned / 3 planned
    });
    expect(report.totals).toEqual({
      planned: 3,
      logged: 3,
      engagementPct: 100,
      adherencePct: 33,
    });
    expect(report.statusBreakdown).toEqual({
      eaten_planned: 1,
      eaten_other: 1,
      skipped: 1,
    });
  });

  it("computes partial engagement/adherence per day and overall", () => {
    const days = plannedRange("2026-06-01", 2, 2); // 2 days, 2 slots each → 4 planned
    const report = computeAdherence(days, [
      { logDate: "2026-06-01", status: "eaten_planned" },
      { logDate: "2026-06-01", status: "eaten_other" },
      { logDate: "2026-06-02", status: "eaten_planned" },
    ]);

    expect(report.days[0]).toEqual({
      date: "2026-06-01",
      planned: 2,
      logged: 2,
      engagementPct: 100, // 2 logged / 2
      adherencePct: 50, // 1 eaten_planned / 2
    });
    expect(report.days[1]).toEqual({
      date: "2026-06-02",
      planned: 2,
      logged: 1,
      engagementPct: 50, // 1 logged / 2
      adherencePct: 50, // 1 eaten_planned / 2
    });
    // engagement 3 logged / 4 planned = 75%; adherence 2 eaten_planned / 4 = 50%.
    expect(report.totals.engagementPct).toBe(75);
    expect(report.totals.adherencePct).toBe(50);
    expect(report.statusBreakdown).toEqual({
      eaten_planned: 2,
      eaten_other: 1,
      skipped: 0,
    });
  });

  it("caps both metrics at 100% even with extra logs on a day", () => {
    const days = plannedRange("2026-06-01", 1, 1); // 1 planned slot
    const report = computeAdherence(days, [
      { logDate: "2026-06-01", status: "eaten_planned" },
      { logDate: "2026-06-01", status: "eaten_planned" },
    ]);

    expect(report.days[0]?.engagementPct).toBe(100);
    expect(report.days[0]?.adherencePct).toBe(100);
    expect(report.totals.engagementPct).toBe(100);
    expect(report.totals.adherencePct).toBe(100);
  });

  it("handles planned-zero days (before the cycle starts) without NaN", () => {
    const report = computeAdherence(
      [
        { date: "2026-06-01", planned: 0 },
        { date: "2026-06-02", planned: 2 },
      ],
      [{ logDate: "2026-06-02", status: "eaten_planned" }]
    );

    expect(report.days[0]).toEqual({
      date: "2026-06-01",
      planned: 0,
      logged: 0,
      engagementPct: 0,
      adherencePct: 0,
    });
    expect(report.totals).toEqual({
      planned: 2,
      logged: 1,
      engagementPct: 50,
      adherencePct: 50,
    });
  });

  it("buckets into 7-day weeks, including a final fractional week", () => {
    const days = plannedRange("2026-06-01", 10, 1); // 10 days → 7 + 3
    const report = computeAdherence(days, [
      { logDate: "2026-06-01", status: "eaten_planned" },
      { logDate: "2026-06-08", status: "skipped" },
    ]);

    expect(report.weeks).toHaveLength(2);
    expect(report.weeks[0]).toEqual({
      weekStart: "2026-06-01",
      weekEnd: "2026-06-07",
      planned: 7,
      logged: 1,
      engagementPct: 14, // round(1/7*100)
      adherencePct: 14, // the 1 log was eaten_planned
    });
    expect(report.weeks[1]).toEqual({
      weekStart: "2026-06-08",
      weekEnd: "2026-06-10",
      planned: 3,
      logged: 1,
      engagementPct: 33, // round(1/3*100)
      adherencePct: 0, // the 1 log was a skip → no on-plan adherence
    });
  });

  it("returns a clean empty report for an empty range", () => {
    const report = computeAdherence([], []);

    expect(report).toEqual({
      from: "",
      to: "",
      totals: { planned: 0, logged: 0, engagementPct: 0, adherencePct: 0 },
      statusBreakdown: { eaten_planned: 0, eaten_other: 0, skipped: 0 },
      days: [],
      weeks: [],
    });
  });

  it("derives from/to from the day range", () => {
    const report = computeAdherence(plannedRange("2026-06-01", 5, 1), []);

    expect(report.from).toBe("2026-06-01");
    expect(report.to).toBe("2026-06-05");
  });
});

describe("buildPlannedDays", () => {
  it("is all-zero when there is no active cycle", () => {
    expect(buildPlannedDays("2026-06-01", "2026-06-03", null)).toEqual([
      { date: "2026-06-01", planned: 0 },
      { date: "2026-06-02", planned: 0 },
      { date: "2026-06-03", planned: 0 },
    ]);
  });

  it("maps each date to its rotation day's slot count", () => {
    const days = buildPlannedDays("2026-06-01", "2026-06-04", {
      startDate: "2026-06-01",
      durationDays: 2,
      plannedByDayIndex: [1, 2], // day 0 → 1 slot, day 1 → 2 slots
    });

    expect(days).toEqual([
      { date: "2026-06-01", planned: 1 }, // idx 0
      { date: "2026-06-02", planned: 2 }, // idx 1
      { date: "2026-06-03", planned: 1 }, // idx 0 (wraps)
      { date: "2026-06-04", planned: 2 }, // idx 1
    ]);
  });

  it("plans zero for dates before the cycle start", () => {
    const days = buildPlannedDays("2026-06-01", "2026-06-03", {
      startDate: "2026-06-03",
      durationDays: 2,
      plannedByDayIndex: [3, 1],
    });

    expect(days).toEqual([
      { date: "2026-06-01", planned: 0 },
      { date: "2026-06-02", planned: 0 },
      { date: "2026-06-03", planned: 3 }, // idx 0 on start day
    ]);
  });
});
