import { describe, expect, it } from "vitest";

import {
  EXERCISE_STATS,
  SAMPLE_SESSION,
  SESSION_STATS,
  type ShareExercise,
  buildShareExercises,
  defaultStats,
  durationMinutes,
  heroSet,
  muscleHeat,
  pickStats,
} from "../session-data";

const bench = SAMPLE_SESSION.exercises[0]!;

describe("buildShareExercises", () => {
  const log = {
    id: "log-1",
    exerciseId: "ex-1",
    name: "Press banca",
    primaryMuscles: ["pectoral"],
    secondaryMuscles: ["triceps", "unknown"],
    sets: [
      { reps: 8, weight_kg: 80 },
      { reps: 0, weight_kg: 0 },
      { reps: 5, weight_kg: 95 },
    ],
    videoUrls: [null, "https://cdn.example/set.mp4"],
    durationSeconds: null,
    distanceMeters: null,
  };

  it("drops empty rows, keeps the first https video", () => {
    const [ex] = buildShareExercises([log], new Map());

    expect(ex!.sets).toEqual([
      { reps: 8, weightKg: 80 },
      { reps: 5, weightKg: 95 },
    ]);
    expect(ex!.videoUrl).toBe("https://cdn.example/set.mp4");
  });

  it("ignores muscles outside the taxonomy instead of failing", () => {
    const [ex] = buildShareExercises([log], new Map());

    expect(ex!.primary).toEqual([]);
    expect(ex!.secondary).toEqual([]);
  });

  it("marks the record set only when there is history to beat", () => {
    const [none] = buildShareExercises([log], new Map());

    expect(none!.recordIndex).toBeNull();

    const prior = new Map([
      ["ex-1", [{ date: "2026-10-01", sets: [{ reps: 5, weight_kg: 90 }] }]],
    ]);
    const [withHistory] = buildShareExercises([log], prior);

    expect(withHistory!.recordIndex).toBe(1);
  });
});

describe("stats", () => {
  it("hero set prefers the record over the best e1RM", () => {
    expect(heroSet(bench)).toEqual({ reps: 3, weightKg: 100 });
  });

  it("only offers stats the session actually has", () => {
    const keys = defaultStats(
      SESSION_STATS,
      ["duration", "cardio", "sets"],
      SAMPLE_SESSION
    );

    expect(keys[0]).toBe("duration");
    expect(keys).not.toContain("cardio");
    expect(keys).toHaveLength(3);
  });

  it("formats values in Spanish", () => {
    expect(pickStats(SESSION_STATS, ["volume"], SAMPLE_SESSION)).toEqual([
      { label: "Volumen", value: "5496 kg" },
    ]);
    expect(pickStats(EXERCISE_STATS, ["best"], bench)).toEqual([
      { label: "Mejor serie", value: "100 kg × 3" },
    ]);
  });

  it("duration needs a start and a sane end", () => {
    expect(durationMinutes(SAMPLE_SESSION)).toBe(64);
    expect(durationMinutes({ ...SAMPLE_SESSION, startTime: null })).toBeNull();
  });
});

describe("muscleHeat", () => {
  it("primary counts a set, secondary half, normalised to the top muscle", () => {
    const ex = (primary: ShareExercise["primary"], sets: number) =>
      ({
        ...bench,
        primary,
        secondary: ["triceps"],
        sets: Array.from({ length: sets }, () => ({ reps: 5, weightKg: 50 })),
      }) as ShareExercise;

    const heat = muscleHeat([ex(["pectoral"], 4), ex(["dorsal"], 2)]);

    expect(heat.pectoral).toBe(1);
    expect(heat.dorsal).toBe(0.5);
    expect(heat.triceps).toBe(0.75);
  });
});
