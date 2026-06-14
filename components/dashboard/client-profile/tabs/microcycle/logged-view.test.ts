import type { ExerciseLog } from "../progress/types";
import type { PrescribedExercise } from "./types";

import { describe, expect, it } from "vitest";

import { buildLoggedExerciseGroups, countLoggedSets } from "./logged-view";

function prescribed(id: string, name: string): PrescribedExercise {
  return {
    exerciseId: id,
    name,
    category: "strength",
    prescribedSets: 3,
    prescribedReps: "10",
    prescribedWeightKg: null,
    prescribedRir: null,
  };
}

function log(exerciseId: string, name: string, setCount: number): ExerciseLog {
  return {
    id: `log-${exerciseId}`,
    exercise_id: exerciseId,
    exercises: {
      id: exerciseId,
      name,
      category: "strength",
      muscle_groups: null,
    },
    scheduled_date: "2026-06-02",
    completed_at: "2026-06-02T12:00:00Z",
    sets: Array.from({ length: setCount }, (_, i) => ({
      set_number: i + 1,
      reps: 10,
      weight_kg: 50,
    })),
    video_url: null,
    duration_minutes: null,
    distance_km: null,
    intensity: null,
    avg_heart_rate: null,
    notes: null,
  };
}

describe("buildLoggedExerciseGroups", () => {
  it("tags nothing off-plan when the client did exactly the prescription", () => {
    const rx = [prescribed("a", "Press banca"), prescribed("b", "Remo")];
    const groups = buildLoggedExerciseGroups(rx, [
      log("a", "Press banca", 3),
      log("b", "Remo", 3),
    ]);

    expect(groups.map((g) => g.exerciseId)).toEqual(["a", "b"]);
    expect(groups.every((g) => !g.offPlan)).toBe(true);
  });

  it("keeps off-plan logged exercises and tags them (partial overlap)", () => {
    // The original bug: with one matching exercise the trainer hid the rest.
    const rx = [prescribed("a", "Press banca"), prescribed("b", "Remo")];
    const groups = buildLoggedExerciseGroups(rx, [
      log("a", "Press banca", 3), // prescribed
      log("x", "Curl araña", 3), // off-plan
      log("y", "Cruces de poleas", 2), // off-plan
    ]);

    // All three are shown — none are dropped.
    expect(groups.map((g) => g.exerciseId)).toEqual(["a", "x", "y"]);
    expect(groups.find((g) => g.exerciseId === "a")?.offPlan).toBe(false);
    expect(groups.find((g) => g.exerciseId === "x")?.offPlan).toBe(true);
    expect(groups.find((g) => g.exerciseId === "y")?.offPlan).toBe(true);
  });

  it("tags everything off-plan when the client fully diverged", () => {
    const rx = [prescribed("a", "Press banca")];
    const groups = buildLoggedExerciseGroups(rx, [log("z", "Sentadilla", 4)]);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.offPlan).toBe(true);
  });

  it("treats a session with no prescription as all off-plan", () => {
    const groups = buildLoggedExerciseGroups([], [log("z", "Sentadilla", 4)]);

    expect(groups[0]?.offPlan).toBe(true);
  });

  it("merges multiple logs of the same exercise into one group, first-seen order", () => {
    const rx = [prescribed("a", "Press banca")];
    const groups = buildLoggedExerciseGroups(rx, [
      log("b", "Remo", 1),
      log("a", "Press banca", 2),
      log("b", "Remo", 1),
    ]);

    expect(groups.map((g) => g.exerciseId)).toEqual(["b", "a"]);
    expect(groups.find((g) => g.exerciseId === "b")?.logs).toHaveLength(2);
  });

  it("returns nothing for an empty log list", () => {
    expect(buildLoggedExerciseGroups([prescribed("a", "x")], [])).toEqual([]);
  });
});

describe("countLoggedSets", () => {
  it("sums sets across all logs, including off-plan ones", () => {
    expect(
      countLoggedSets([log("a", "Press banca", 3), log("x", "Curl araña", 2)])
    ).toBe(5);
  });

  it("is zero for no logs", () => {
    expect(countLoggedSets([])).toBe(0);
  });
});
