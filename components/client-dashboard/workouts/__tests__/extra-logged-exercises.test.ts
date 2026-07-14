import { describe, expect, it } from "vitest";

import { collectExtraLoggedExercises } from "../extra-logged-exercises";

const SESSION_A = "session-a";
const SESSION_B = "session-b";

describe("collectExtraLoggedExercises", () => {
  const template = new Set(["ex-1", "ex-2"]);

  it("appends off-template logs that belong to the active session", () => {
    const extras = collectExtraLoggedExercises(
      [
        {
          exercise_id: "ex-3",
          session_id: SESSION_A,
          exercises: { name: "Curl" },
        },
      ],
      SESSION_A,
      template
    );

    expect(extras).toHaveLength(1);
    expect(extras[0]).toMatchObject({ exercise_id: "ex-3", name: "Curl" });
  });

  it("excludes logs attributed to a DIFFERENT session", () => {
    // Regression: ejercicios de otra sesión del mismo día se "sumaban" a la
    // sesión activa (7 prescritos → el cliente veía 9 y los hacía todos).
    const extras = collectExtraLoggedExercises(
      [
        { exercise_id: "ex-3", session_id: SESSION_B },
        { exercise_id: "ex-4", session_id: SESSION_B },
      ],
      SESSION_A,
      template
    );

    expect(extras).toHaveLength(0);
  });

  it("keeps logs without session attribution (legacy/ad-hoc)", () => {
    const extras = collectExtraLoggedExercises(
      [{ exercise_id: "ex-5", session_id: null }],
      SESSION_A,
      template
    );

    expect(extras).toHaveLength(1);
  });

  it("skips template exercises, dedupes, and skips logs without exercise_id", () => {
    const extras = collectExtraLoggedExercises(
      [
        { exercise_id: "ex-1", session_id: SESSION_A },
        { exercise_id: "ex-3", session_id: SESSION_A },
        { exercise_id: "ex-3", session_id: SESSION_A },
        { session_id: SESSION_A },
      ],
      SESSION_A,
      template
    );

    expect(extras).toHaveLength(1);
    expect(extras[0]?.exercise_id).toBe("ex-3");
  });

  it("falls back to exercise_name and then the id for display names", () => {
    const extras = collectExtraLoggedExercises(
      [
        { exercise_id: "ex-6", session_id: SESSION_A, exercise_name: "Remo" },
        { exercise_id: "ex-7", session_id: SESSION_A },
      ],
      SESSION_A,
      template
    );

    expect(extras.map((e) => e.name)).toEqual(["Remo", "ex-7"]);
  });

  it("assigns orders after the template block (1000+)", () => {
    const extras = collectExtraLoggedExercises(
      [
        { exercise_id: "ex-8", session_id: SESSION_A },
        { exercise_id: "ex-9", session_id: SESSION_A },
      ],
      SESSION_A,
      template
    );

    expect(extras.map((e) => e.order)).toEqual([1000, 1001]);
  });
});
