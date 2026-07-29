import { describe, expect, it } from "vitest";

import {
  buildProgression,
  parseDaysParam,
} from "@/lib/training/progression-query";

// Filas con la forma exacta que devuelve el select de fetchProgression.
function row(
  date: string | null,
  sets: Array<{ reps: number | null; weight_kg: number | null }>
) {
  return {
    id: `log-${date}-${Math.random()}`,
    finalized_at: "2026-07-01T10:00:00.000Z",
    scheduled_sessions: date === null ? null : { scheduled_date: date },
    exercise_log_sets: sets,
  };
}

describe("buildProgression", () => {
  it("returns the empty shape when there are no rows", () => {
    expect(buildProgression([])).toEqual({
      e1rmSeries: [],
      repMaxes: [],
      currentE1rm: null,
      bestE1rm: null,
      totalSessions: 0,
    });
  });

  it("builds one point per date from the best set of that day", () => {
    const progression = buildProgression([
      row("2026-01-10", [
        { reps: 5, weight_kg: 80 },
        { reps: 3, weight_kg: 90 },
      ]),
      row("2026-01-17", [{ reps: 5, weight_kg: 85 }]),
    ]);

    expect(progression.e1rmSeries).toHaveLength(2);
    expect(progression.totalSessions).toBe(2);
    // 3 reps @ 90 = Brzycki 90*36/34 ≈ 95.3 gana al 5x80 (≈ 90).
    expect(progression.e1rmSeries[0]?.weightKg).toBe(90);
    expect(progression.e1rmSeries[0]?.reps).toBe(3);
  });

  it("sums volume across ALL sets of a date, nulls counting as zero", () => {
    const progression = buildProgression([
      row("2026-01-10", [
        { reps: 5, weight_kg: 80 }, // 400
        { reps: 5, weight_kg: 80 }, // 400
        { reps: null, weight_kg: 80 }, // 0
        { reps: 5, weight_kg: null }, // 0
      ]),
    ]);

    expect(progression.e1rmSeries[0]?.volumeKg).toBe(800);
  });

  it("adds the volume of every log that shares a date", () => {
    const progression = buildProgression([
      row("2026-01-10", [{ reps: 10, weight_kg: 50 }]),
      row("2026-01-10", [{ reps: 10, weight_kg: 60 }]),
    ]);

    expect(progression.e1rmSeries).toHaveLength(1);
    expect(progression.e1rmSeries[0]?.volumeKg).toBe(1100);
  });

  it("sorts the series ascending regardless of row order", () => {
    const progression = buildProgression([
      row("2026-03-01", [{ reps: 5, weight_kg: 100 }]),
      row("2026-01-01", [{ reps: 5, weight_kg: 80 }]),
      row("2026-02-01", [{ reps: 5, weight_kg: 90 }]),
    ]);

    expect(progression.e1rmSeries.map((p) => p.date)).toEqual([
      "2026-01-01",
      "2026-02-01",
      "2026-03-01",
    ]);
  });

  it("reports current as the last point and best as the maximum", () => {
    const progression = buildProgression([
      row("2026-01-01", [{ reps: 1, weight_kg: 120 }]),
      row("2026-02-01", [{ reps: 1, weight_kg: 100 }]),
    ]);

    expect(progression.currentE1rm).toBe(100);
    expect(progression.bestE1rm).toBe(120);
  });

  it("skips rows without a scheduled_date and days with no computable set", () => {
    const progression = buildProgression([
      row(null, [{ reps: 5, weight_kg: 100 }]),
      row("2026-01-05", [{ reps: 12, weight_kg: null }]),
      row("2026-01-06", [{ reps: 5, weight_kg: 60 }]),
    ]);

    expect(progression.e1rmSeries.map((p) => p.date)).toEqual(["2026-01-06"]);
    expect(progression.totalSessions).toBe(1);
  });

  it("tolerates a null sets array", () => {
    const progression = buildProgression([
      {
        id: "log-empty",
        finalized_at: "2026-07-01T10:00:00.000Z",
        scheduled_sessions: { scheduled_date: "2026-01-10" },
        exercise_log_sets: null,
      },
    ]);

    expect(progression.e1rmSeries).toEqual([]);
  });

  it("exposes rep maxes bucket-sorted", () => {
    const progression = buildProgression([
      row("2026-01-10", [
        { reps: 12, weight_kg: 40 },
        { reps: 1, weight_kg: 100 },
        { reps: 5, weight_kg: 80 },
      ]),
    ]);

    expect(progression.repMaxes.map((r) => r.bucket)).toEqual([
      "1",
      "5",
      "12+",
    ]);
  });
});

describe("parseDaysParam", () => {
  it("defaults to 365 when absent or unparseable", () => {
    expect(parseDaysParam(null)).toBe(365);
    expect(parseDaysParam("")).toBe(365);
    expect(parseDaysParam("abc")).toBe(365);
  });

  it("clamps to 1..730", () => {
    expect(parseDaysParam("0")).toBe(1);
    expect(parseDaysParam("-30")).toBe(1);
    expect(parseDaysParam("9999")).toBe(730);
    expect(parseDaysParam("90")).toBe(90);
  });
});
