import type { MealCycleTree, MealSlotWithOptions } from "../meal-cycle-service";

import { describe, expect, it } from "vitest";

import {
  buildClientCycleView,
  currentCycleDayIndex,
  groupSlotsByDay,
} from "../cycle-day";

function slot(
  partial: Partial<MealSlotWithOptions> & { day_index: number }
): MealSlotWithOptions {
  return {
    id: `slot-${partial.day_index}-${partial.position ?? 0}`,
    cycle_id: "cycle-1",
    tenant_host: "t.local",
    label: "",
    position: 0,
    created_at: "2026-06-01T00:00:00Z",
    updated_at: "2026-06-01T00:00:00Z",
    options: [],
    ...partial,
  };
}

describe("currentCycleDayIndex", () => {
  it("is day 0 when today is the start date", () => {
    expect(currentCycleDayIndex("2026-06-03", 5, "2026-06-03")).toEqual({
      started: true,
      dayIndex: 0,
    });
  });

  it("counts whole days from the start (mid-cycle)", () => {
    // 2 days after a 5-day cycle start → day index 2.
    expect(currentCycleDayIndex("2026-06-01", 5, "2026-06-03")).toEqual({
      started: true,
      dayIndex: 2,
    });
  });

  it("wraps around past the end of the rotation", () => {
    // 7 days into a 5-day cycle → 7 mod 5 = 2.
    expect(currentCycleDayIndex("2026-06-01", 5, "2026-06-08")).toEqual({
      started: true,
      dayIndex: 2,
    });
  });

  it("lands on the last day exactly at the rotation boundary minus one", () => {
    // day 4 of a 5-day cycle is the final day.
    expect(currentCycleDayIndex("2026-06-01", 5, "2026-06-05")).toEqual({
      started: true,
      dayIndex: 4,
    });
  });

  it("returns to day 0 exactly one full rotation later", () => {
    expect(currentCycleDayIndex("2026-06-01", 5, "2026-06-06")).toEqual({
      started: true,
      dayIndex: 0,
    });
  });

  it("reports not-started before the start date", () => {
    expect(currentCycleDayIndex("2026-06-10", 5, "2026-06-03")).toEqual({
      started: false,
      dayIndex: null,
    });
  });

  it("handles a one-day cycle (always day 0 once started)", () => {
    expect(currentCycleDayIndex("2026-06-01", 1, "2026-06-09")).toEqual({
      started: true,
      dayIndex: 0,
    });
  });

  it("defaults to UTC calendar days when no timezone is given", () => {
    expect(
      currentCycleDayIndex(
        new Date("2026-06-01T23:30:00Z"),
        3,
        new Date("2026-06-03T00:15:00Z")
      )
    ).toEqual({ started: true, dayIndex: 2 });
  });
});

describe("currentCycleDayIndex — timezone", () => {
  // One instant; "today" is a different calendar day depending on the client's
  // timezone, so the cycle day must differ too. At 2026-06-02T12:30:00Z it is
  // already 2026-06-03 in Auckland (UTC+12) but still 2026-06-02 in LA (UTC-7).
  const instant = new Date("2026-06-02T12:30:00Z");

  it("resolves a later cycle day for a client just past midnight in Auckland", () => {
    expect(
      currentCycleDayIndex("2026-06-01", 5, instant, "Pacific/Auckland")
    ).toEqual({ started: true, dayIndex: 2 });
  });

  it("resolves an earlier cycle day for the same instant in Los Angeles", () => {
    expect(
      currentCycleDayIndex("2026-06-01", 5, instant, "America/Los_Angeles")
    ).toEqual({ started: true, dayIndex: 1 });
  });

  it("defaults to UTC (same instant → the UTC calendar day)", () => {
    expect(currentCycleDayIndex("2026-06-01", 5, instant)).toEqual({
      started: true,
      dayIndex: 1,
    });
  });

  it("treats not-started in the client's own timezone", () => {
    // 2026-06-01T06:00Z is still 2026-05-31 in Los Angeles → before a cycle
    // that starts 2026-06-01, even though it is already June 1 in UTC.
    const earlyJune1 = new Date("2026-06-01T06:00:00Z");

    expect(
      currentCycleDayIndex("2026-06-01", 5, earlyJune1, "America/Los_Angeles")
    ).toEqual({ started: false, dayIndex: null });
    expect(currentCycleDayIndex("2026-06-01", 5, earlyJune1, "UTC")).toEqual({
      started: true,
      dayIndex: 0,
    });
  });
});

describe("groupSlotsByDay", () => {
  it("creates one bucket per rotation day, even when empty", () => {
    const days = groupSlotsByDay(3, []);

    expect(days).toHaveLength(3);
    expect(days.map((d) => d.dayIndex)).toEqual([0, 1, 2]);
    expect(days.every((d) => d.slots.length === 0)).toBe(true);
  });

  it("places each slot in its day bucket, preserving order", () => {
    const slots = [
      slot({ day_index: 0, position: 0, label: "Desayuno" }),
      slot({ day_index: 0, position: 1, label: "Almuerzo" }),
      slot({ day_index: 2, position: 0, label: "Cena" }),
    ];

    const days = groupSlotsByDay(3, slots);

    expect(days[0]?.slots.map((s) => s.label)).toEqual([
      "Desayuno",
      "Almuerzo",
    ]);
    expect(days[1]?.slots).toHaveLength(0);
    expect(days[2]?.slots.map((s) => s.label)).toEqual(["Cena"]);
  });

  it("drops slots whose day_index is out of range", () => {
    const days = groupSlotsByDay(2, [slot({ day_index: 5 })]);

    expect(days).toHaveLength(2);
    expect(days.every((d) => d.slots.length === 0)).toBe(true);
  });
});

describe("buildClientCycleView", () => {
  const tree: MealCycleTree = {
    id: "cycle-1",
    tenant_host: "t.local",
    trainer_id: "trainer-1",
    client_id: 42,
    name: "Plan de definición",
    duration_days: 3,
    start_date: "2026-06-01",
    status: "active",
    created_at: "2026-06-01T00:00:00Z",
    updated_at: "2026-06-01T00:00:00Z",
    slots: [
      slot({ day_index: 0, position: 0, label: "Desayuno" }),
      slot({ day_index: 1, position: 0, label: "Comida" }),
    ],
  };

  it("returns a clean empty view when there is no active cycle", () => {
    const view = buildClientCycleView(null, "2026-06-03");

    expect(view).toEqual({
      cycle: null,
      today: "2026-06-03",
      position: null,
      days: [],
      selections: {},
    });
  });

  it("folds the client's selections into a slot → option map", () => {
    const view = buildClientCycleView(tree, "2026-06-03", "UTC", [
      { slot_id: "slot-0-0", option_id: "opt-x" },
    ]);

    expect(view.selections).toEqual({ "slot-0-0": "opt-x" });
  });

  it("defaults selections to an empty map when none are given", () => {
    expect(buildClientCycleView(tree, "2026-06-03").selections).toEqual({});
  });

  it("projects the cycle, today, position and grouped days", () => {
    const view = buildClientCycleView(tree, "2026-06-03");

    expect(view.cycle).toEqual({
      id: "cycle-1",
      name: "Plan de definición",
      durationDays: 3,
      startDate: "2026-06-01",
      status: "active",
    });
    expect(view.today).toBe("2026-06-03");
    // 2 days into a 3-day rotation → day index 2.
    expect(view.position).toEqual({ started: true, dayIndex: 2 });
    expect(view.days).toHaveLength(3);
    expect(view.days[0]?.slots.map((s) => s.label)).toEqual(["Desayuno"]);
    expect(view.days[1]?.slots.map((s) => s.label)).toEqual(["Comida"]);
    expect(view.days[2]?.slots).toHaveLength(0);
  });

  it("carries the not-started position before the cycle begins", () => {
    const view = buildClientCycleView(tree, "2026-05-20");

    expect(view.position).toEqual({ started: false, dayIndex: null });
    // The days tree is still present so the UI can preview the plan.
    expect(view.days).toHaveLength(3);
  });
});
