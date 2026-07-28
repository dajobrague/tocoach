import { describe, expect, it } from "vitest";

import { cloneSessionExerciseRows, duplicateName } from "../duplicate-session";

describe("duplicateName", () => {
  it("agrega (copia) al nombre origen", () => {
    expect(duplicateName("Empujes A")).toBe("Empujes A (copia)");
  });

  it("recorta espacios y cae a un default con nombre vacío/nulo", () => {
    expect(duplicateName("  Tirón  ")).toBe("Tirón (copia)");
    expect(duplicateName("")).toBe("Sesión (copia)");
    expect(duplicateName(null)).toBe("Sesión (copia)");
    expect(duplicateName(undefined)).toBe("Sesión (copia)");
  });
});

describe("cloneSessionExerciseRows", () => {
  const TARGET = { tenantHost: "acme.tenant", sessionId: "new-session" };

  it("copia la prescripción completa incluyendo custom_name y metadata", () => {
    const rows = cloneSessionExerciseRows(
      [
        {
          exercise_id: "ex-1",
          exercise_order: 2,
          custom_name: "Fondos lastrados",
          sets: 4,
          reps: "8-10",
          duration_seconds: null,
          rest_seconds: 120,
          weight_kg: 20,
          distance_meters: null,
          notes: "codo pegado",
          metadata: { tempo: "3-1-1", training_system: "RIR 2" },
        },
      ],
      TARGET
    );

    expect(rows).toEqual([
      {
        tenant_host: "acme.tenant",
        session_id: "new-session",
        exercise_id: "ex-1",
        exercise_order: 2,
        custom_name: "Fondos lastrados",
        sets: 4,
        reps: "8-10",
        duration_seconds: null,
        rest_seconds: 120,
        weight_kg: 20,
        distance_meters: null,
        notes: "codo pegado",
        metadata: { tempo: "3-1-1", training_system: "RIR 2" },
      },
    ]);
  });

  it("normaliza campos ausentes a null (nunca undefined al insert)", () => {
    const [row] = cloneSessionExerciseRows(
      [{ exercise_id: "ex-2", exercise_order: 1 }],
      TARGET
    );

    expect(row).toMatchObject({
      custom_name: null,
      sets: null,
      reps: null,
      weight_kg: null,
      notes: null,
      metadata: null,
    });
  });
});
