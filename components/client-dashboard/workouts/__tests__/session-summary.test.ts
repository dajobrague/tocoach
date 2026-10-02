import { describe, expect, it } from "vitest";

import { summarizeSession } from "../session-summary";

const at = (date: string, hhmm: string) =>
  new Date(`${date}T${hhmm}:00`).toISOString();

describe("summarizeSession", () => {
  const date = "2026-10-02";
  const logs = [
    {
      exercise_id: "a",
      finalized_at: at(date, "10:20"),
      sets: [
        { reps: 10, weight_kg: 50 },
        { reps: 8, weight_kg: 52.5 },
        { reps: null, weight_kg: null },
      ],
    },
    {
      exercise_id: "b",
      finalized_at: at(date, "10:45"),
      sets: [{ reps: 12, weight_kg: null }],
    },
  ];

  it("cuenta series reales y suma peso × reps", () => {
    const summary = summarizeSession(logs, date, "10:00");

    expect(summary.sets).toBe(3);
    expect(summary.volumeKg).toBe(920);
    expect(summary.durationMinutes).toBe(45);
  });

  it("sin hora de inicio o con intervalo no creíble omite la duración", () => {
    expect(summarizeSession(logs, date, null).durationMinutes).toBeNull();
    expect(summarizeSession(logs, date, "11:00").durationMinutes).toBeNull();
    expect(summarizeSession(logs, date, "02:00").durationMinutes).toBeNull();
    expect(summarizeSession([], date, "10:00").durationMinutes).toBeNull();
  });
});
