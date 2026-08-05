import { describe, expect, it } from "vitest";

import { buildBaseFormData, type ExerciseShape } from "../helpers";

// buildBaseFormData hidrata el form del modal. Dos invariantes críticos:
//
// 1. Reps no numéricas ("8-12", "AMRAP") NUNCA entran como value — el
//    input number las mostraría vacías mientras el save persistía el
//    límite inferior (parseInt("8-12") → 8) como series hechas. Van
//    como repsPlaceholder y solo persiste lo que el cliente teclea.
//
// 2. lastUsedWeights solo prellenan logs NUEVOS. Al reabrir un log
//    existente el form muestra exactamente lo guardado — un peso vacío
//    guardado es deliberado (peso corporal) y prellenarlo re-atribuía
//    los kilos de la sesión anterior.

const exercise = (overrides: Partial<ExerciseShape> = {}): ExerciseShape => ({
  id: "ex-1",
  name: "Dominadas",
  sets: 3,
  reps: "10",
  ...overrides,
});

describe("buildBaseFormData — reps de prescripción", () => {
  it("prellena reps numéricas como value, sin placeholder", () => {
    const form = buildBaseFormData(exercise({ reps: "12" }), null);

    expect(form.sets).toHaveLength(3);
    for (const s of form.sets) {
      expect(s.reps).toBe("12");
      expect((s as any).repsPlaceholder).toBeUndefined();
    }
  });

  it("un rango ('8-12') va como placeholder con value vacío", () => {
    const form = buildBaseFormData(exercise({ reps: "8-12" }), null);

    for (const s of form.sets) {
      expect(s.reps).toBe("");
      expect((s as any).repsPlaceholder).toBe("8-12");
    }
  });

  it("texto libre ('AMRAP') también va como placeholder", () => {
    const form = buildBaseFormData(exercise({ reps: "AMRAP", sets: 2 }), null);

    for (const s of form.sets) {
      expect(s.reps).toBe("");
      expect((s as any).repsPlaceholder).toBe("AMRAP");
    }
  });

  it("pipe mixto: cada set decide value vs placeholder por separado", () => {
    const form = buildBaseFormData(
      exercise({ reps: "12 | 8-10", sets: 2 }),
      null
    );

    expect(form.sets[0]).toMatchObject({ reps: "12" });
    expect((form.sets[0] as any).repsPlaceholder).toBeUndefined();
    expect(form.sets[1]).toMatchObject({ reps: "" });
    expect((form.sets[1] as any).repsPlaceholder).toBe("8-10");
  });

  it("sin reps prescritas no agrega placeholder", () => {
    const form = buildBaseFormData(exercise({ reps: "", sets: 2 }), null);

    for (const s of form.sets) {
      expect(s.reps).toBe("");
      expect((s as any).repsPlaceholder).toBeUndefined();
    }
  });
});

describe("buildBaseFormData — prefill de lastUsedWeights", () => {
  it("prellena pesos vacíos en un log NUEVO (sin log existente)", () => {
    const form = buildBaseFormData(
      exercise({ lastUsedWeights: [10, 12, null] }),
      null
    );

    expect(form.sets.map((s) => s.weight)).toEqual(["10", "12", "12"]);
  });

  it("NO pisa el peso uniforme prescrito", () => {
    const form = buildBaseFormData(
      exercise({ weightKg: 20, lastUsedWeights: [10, 10, 10] }),
      null
    );

    expect(form.sets.map((s) => s.weight)).toEqual(["20", "20", "20"]);
  });

  it("reabrir un log existente muestra los pesos guardados, incluidos los vacíos deliberados", () => {
    // Sesión a peso corporal: el cliente guardó weight_kg null a propósito.
    const existingLog = {
      finalized_at: "2026-08-04T10:00:00Z",
      sets: [
        { reps: 10, weight_kg: null },
        { reps: 8, weight_kg: null },
      ],
    };
    const form = buildBaseFormData(
      exercise({ lastUsedWeights: [10, 10] }),
      existingLog
    );

    expect(form.sets.map((s) => s.weight)).toEqual(["", ""]);
    expect(form.sets.map((s) => s.reps)).toEqual(["10", "8"]);
  });

  it("tampoco prellena el path legacy sets_completed (log existente)", () => {
    const form = buildBaseFormData(exercise({ lastUsedWeights: [15] }), {
      sets_completed: 2,
      reps_completed: "10 reps",
    });

    expect(form.sets.map((s) => s.weight)).toEqual(["", ""]);
  });

  it("un autosave vacío sin finalizar cuenta como log nuevo y sí prellena", () => {
    // hasUsableExistingSets lo descarta → cae a la prescripción.
    const emptyAutosave = {
      finalized_at: null,
      sets: [
        { reps: null, weight_kg: null },
        { reps: null, weight_kg: null },
        { reps: null, weight_kg: null },
      ],
    };
    const form = buildBaseFormData(
      exercise({ lastUsedWeights: [10, 12, 14] }),
      emptyAutosave
    );

    expect(form.sets.map((s) => s.weight)).toEqual(["10", "12", "14"]);
  });
});
