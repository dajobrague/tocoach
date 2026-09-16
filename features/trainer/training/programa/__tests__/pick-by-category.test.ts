import type { WorkoutProgram } from "../training-api";

import { describe, expect, it } from "vitest";

import { pickByCategory } from "../programa-format";

const program = (
  programId: string,
  category: "strength" | "cardio",
  status: WorkoutProgram["status"]
): WorkoutProgram =>
  ({ programId, category, status, sessions: [] }) as unknown as WorkoutProgram;

const none = { strength: null, cardio: null };

describe("pickByCategory", () => {
  it("por defecto muestra el primer activo de cada categoría y enfoca fuerza", () => {
    const programs = [
      program("c1", "cardio", "active"),
      program("s1", "strength", "active"),
      program("s2", "strength", "active"),
    ];
    const result = pickByCategory(programs, none, "strength");

    expect(result.byCategory.strength?.programId).toBe("s1");
    expect(result.byCategory.cardio?.programId).toBe("c1");
    expect(result.focused).toBe("strength");
  });

  it("respeta el elegido a mano aunque esté pausado", () => {
    const programs = [
      program("s1", "strength", "active"),
      program("s2", "strength", "paused"),
    ];
    const result = pickByCategory(
      programs,
      { strength: "s2", cardio: null },
      "strength"
    );

    expect(result.byCategory.strength?.programId).toBe("s2");
  });

  it("sin activos cae al primer pausado; completed/cancelled no cuentan", () => {
    const programs = [
      program("c1", "cardio", "paused"),
      program("x", "strength", "completed"),
    ];
    const result = pickByCategory(programs, none, "strength");

    expect(result.byCategory.cardio?.programId).toBe("c1");
    expect(result.byCategory.strength).toBeNull();
  });

  it("si la categoría enfocada está vacía, el foco pasa a la otra", () => {
    const onlyCardio = [program("c1", "cardio", "active")];

    expect(pickByCategory(onlyCardio, none, "strength").focused).toBe("cardio");
    expect(pickByCategory([], none, "cardio").focused).toBe("cardio");
  });

  it("un id que ya no existe (borrado) cae al siguiente activo", () => {
    const programs = [program("s1", "strength", "active")];
    const result = pickByCategory(
      programs,
      { strength: "gone", cardio: null },
      "strength"
    );

    expect(result.byCategory.strength?.programId).toBe("s1");
  });
});
