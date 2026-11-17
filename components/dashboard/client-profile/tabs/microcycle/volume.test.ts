import type { ExerciseLog } from "../progress/types";
import type { DayMetrics } from "./types";

import { describe, expect, it } from "vitest";

import { weekVolume } from "./volume";

const log = (id: string, sets: Array<[number, number | null]>) =>
  ({
    id,
    sets: sets.map(([reps, weight_kg]) => ({ reps, weight_kg })),
  }) as unknown as ExerciseLog;

const day = (...logsPerSession: ExerciseLog[][]) =>
  ({
    sessions: logsPerSession.map((logs) => ({ logs })),
  }) as unknown as DayMetrics;

describe("weekVolume", () => {
  it("sums reps × kg across days and sessions, once per log", () => {
    const shared = log("a", [[10, 50]]); // 500
    const days = [
      day([shared], [shared]), // mismo log en dos sesiones: cuenta una vez
      day([
        log("b", [
          [8, 60],
          [8, 62.5],
        ]),
      ]), // 480 + 500
      day([log("c", [[12, null]])]), // sin peso (cardio/peso corporal): 0
      day(),
    ];

    expect(weekVolume(days)).toBe(1480);
  });
});
