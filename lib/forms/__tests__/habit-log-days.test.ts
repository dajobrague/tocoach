import { describe, expect, it } from "vitest";

import {
  habitLogDaysFromFeatures,
  parseHabitLogDays,
} from "@/lib/forms/habit-log-days";

describe("habit log days", () => {
  it("defaults to 3 for missing or invalid values", () => {
    expect(habitLogDaysFromFeatures(null)).toBe(3);
    expect(habitLogDaysFromFeatures({})).toBe(3);
    expect(habitLogDaysFromFeatures({ habit_log_days: 99 })).toBe(3);
    expect(habitLogDaysFromFeatures({ habit_log_days: "7" })).toBe(3);
  });

  it("reads an allowed value", () => {
    expect(habitLogDaysFromFeatures({ habit_log_days: 7 })).toBe(7);
    expect(parseHabitLogDays(1)).toBe(1);
    expect(parseHabitLogDays(0)).toBeNull();
  });
});
