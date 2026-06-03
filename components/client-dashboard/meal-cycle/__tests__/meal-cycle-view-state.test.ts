import type { ClientCycleView } from "@/lib/nutrition/cycles/cycle-day";

import { describe, expect, it } from "vitest";

import { resolveMealCycleViewState } from "../meal-cycle-view-state";

const EMPTY: ClientCycleView = {
  cycle: null,
  today: "2026-06-03",
  position: null,
  days: [],
};

function activeView(overrides: Partial<ClientCycleView> = {}): ClientCycleView {
  return {
    cycle: {
      id: "c1",
      name: "Plan",
      durationDays: 3,
      startDate: "2026-06-01",
      status: "active",
    },
    today: "2026-06-03",
    position: { started: true, dayIndex: 1 },
    days: [
      { dayIndex: 0, slots: [] },
      { dayIndex: 1, slots: [] },
      { dayIndex: 2, slots: [] },
    ],
    ...overrides,
  };
}

describe("resolveMealCycleViewState", () => {
  it("is 'empty' when there is no active cycle", () => {
    expect(resolveMealCycleViewState(EMPTY)).toEqual({ kind: "empty" });
  });

  it("is 'not-started' before the cycle begins", () => {
    const view = activeView({ position: { started: false, dayIndex: null } });

    expect(resolveMealCycleViewState(view)).toEqual({ kind: "not-started" });
  });

  it("is 'active' and points at today's day once started", () => {
    const state = resolveMealCycleViewState(activeView());

    expect(state).toEqual({
      kind: "active",
      activeDayIndex: 1,
      activeDay: { dayIndex: 1, slots: [] },
    });
  });

  it("tolerates a day index with no matching bucket (activeDay null)", () => {
    const view = activeView({
      position: { started: true, dayIndex: 5 },
      days: [{ dayIndex: 0, slots: [] }],
    });

    expect(resolveMealCycleViewState(view)).toEqual({
      kind: "active",
      activeDayIndex: 5,
      activeDay: null,
    });
  });
});
