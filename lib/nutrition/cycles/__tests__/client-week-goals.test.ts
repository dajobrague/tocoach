import type { ClientWeek, ClientWeekDay } from "../client-week";

import { describe, expect, it } from "vitest";

import { attachDayGoals } from "../client-week";

function day(dayIndex: number | null): ClientWeekDay {
  return {
    date: "2026-07-06",
    started: dayIndex !== null,
    dayIndex,
    slots: [],
    notes: [],
    logs: {},
    canLog: false,
  };
}

function week(days: ClientWeekDay[]): ClientWeek {
  return {
    weekStart: "2026-07-06",
    cycle: null,
    days,
    selections: {},
  } as ClientWeek;
}

const TRAINING = {
  name: "Día de entrenamiento",
  kcal: 2800,
  protein_g: 180,
  carbs_g: 320,
  fat_g: 80,
};
const FALLBACK = { kcal: 2000, protein_g: 150, carbs_g: 200, fat_g: 60 };

describe("attachDayGoals", () => {
  it("resolves an assigned preset into the day's targets and name", () => {
    const result = attachDayGoals(
      week([day(0), day(1)]),
      { "0": "p1" },
      new Map([["p1", TRAINING]]),
      FALLBACK
    );

    expect(result.days[0]?.targets).toEqual({
      kcal: 2800,
      protein_g: 180,
      carbs_g: 320,
      fat_g: 80,
    });
    expect(result.days[0]?.targetName).toBe("Día de entrenamiento");
    expect(result.days[1]?.targets).toEqual(FALLBACK);
    expect(result.days[1]?.targetName).toBeNull();
  });

  it("falls back for deleted presets, not-started days, and null defaults", () => {
    const result = attachDayGoals(
      week([day(0), day(null)]),
      { "0": "gone" },
      new Map(),
      null
    );

    expect(result.days[0]?.targets).toBeNull();
    expect(result.days[0]?.targetName).toBeNull();
    expect(result.days[1]?.targets).toBeNull();
  });

  it("tolerates malformed day_targets payloads", () => {
    const result = attachDayGoals(
      week([day(0)]),
      "not-an-object",
      new Map([["p1", TRAINING]]),
      FALLBACK
    );

    expect(result.days[0]?.targets).toEqual(FALLBACK);
  });
});
