import type { ExerciseLog } from "../progress/types";
import type { DayAdherence } from "./types";

import { describe, expect, it } from "vitest";

import {
  classificationLabel,
  classifyDay,
  computeDayAdherence,
  type PrescribedSlot,
} from "./adherence";

function adherence(over: Partial<DayAdherence> = {}): DayAdherence {
  return {
    totalPrescribed: 3,
    completedExercises: 0,
    prescribedSetsTotal: 9,
    loggedSetsTotal: 0,
    prescribedLoadTotal: 0,
    loggedLoadTotal: 0,
    ejercicios: 0,
    series: 0,
    seriesRaw: 0,
    hasOverage: false,
    carga: 1,
    ...over,
  };
}

describe("classifyDay — status de la fila manda", () => {
  it("completed manual con cobertura parcial → complete (no 'partial')", () => {
    // El caso de la llamada: cliente marcó completado con 1 de 3 ejercicios.
    const result = classifyDay(
      true,
      adherence({ loggedSetsTotal: 3, completedExercises: 1 }),
      false,
      true
    );

    expect(result).toBe("complete");
  });

  it("completed sin ningún log también es complete (día flojo marcado)", () => {
    expect(classifyDay(true, adherence(), false, true)).toBe("complete");
  });

  it("futuro sigue siendo future aunque el status diga completed", () => {
    expect(classifyDay(true, adherence(), true, true)).toBe("future");
  });

  it("sin status completed conserva la clasificación por cobertura", () => {
    expect(
      classifyDay(
        true,
        adherence({ loggedSetsTotal: 3, completedExercises: 1 }),
        false,
        false
      )
    ).toBe("partial");
    expect(classifyDay(true, adherence(), false, false)).toBe("pending");
    expect(classifyDay(false, adherence({ totalPrescribed: 0 }), false)).toBe(
      "rest"
    );
  });

  it("día apenas empezado (0 ejercicios completos) → partial, no complete", () => {
    // Cliente hizo 2 de 4 series de un único ejercicio: hay trabajo pero
    // ningún ejercicio llegó a su prescripción.
    expect(
      classifyDay(
        true,
        adherence({
          totalPrescribed: 1,
          prescribedSetsTotal: 4,
          loggedSetsTotal: 2,
          completedExercises: 0,
        }),
        false,
        false
      )
    ).toBe("partial");
  });

  it("trabajo sin prescripción (adherencia derivada de logs) sigue complete", () => {
    expect(
      classifyDay(
        true,
        adherence({ totalPrescribed: 0, loggedSetsTotal: 5 }),
        false,
        false
      )
    ).toBe("complete");
  });
});

function prescribedSlot(over: Partial<PrescribedSlot> = {}): PrescribedSlot {
  return {
    exerciseId: "ex-1",
    name: "Sentadilla",
    category: "strength",
    prescribedSets: 4,
    prescribedReps: "5",
    prescribedWeightKg: null,
    prescribedRir: null,
    ...over,
  };
}

function log(
  over: Partial<ExerciseLog> & { setCount?: number } = {}
): ExerciseLog {
  const { setCount = 4, ...rest } = over;

  return {
    id: "log-1",
    exercise_id: "ex-1",
    exercises: {
      id: "ex-1",
      name: "Sentadilla",
      category: "strength",
      muscle_groups: null,
    },
    scheduled_date: "2026-08-03",
    completed_at: "2026-08-03T10:00:00Z",
    sets: Array.from({ length: setCount }, (_, i) => ({
      set_number: i + 1,
      reps: 5,
      weight_kg: 100,
    })),
    video_url: null,
    duration_minutes: null,
    distance_km: null,
    intensity: null,
    avg_heart_rate: null,
    notes: null,
    ...rest,
  };
}

describe("computeDayAdherence — slots duplicados del mismo ejercicio", () => {
  // Sesión con Sentadilla 4×5 (slot A) y Sentadilla 3×8 (slot B).
  const twoSlots = [
    prescribedSlot({ sessionExerciseId: "se-a", prescribedSets: 4 }),
    prescribedSlot({ sessionExerciseId: "se-b", prescribedSets: 3 }),
  ];

  it("log de un slot no cuenta también para el duplicado (match por slot id)", () => {
    const result = computeDayAdherence(twoSlots, [
      log({ session_exercise_id: "se-a", setCount: 4 }),
    ]);

    expect(result.loggedSetsTotal).toBe(4);
    expect(result.prescribedSetsTotal).toBe(7);
    expect(result.completedExercises).toBe(1);
    expect(result.hasOverage).toBe(false);
    expect(classifyDay(true, result, false, false)).toBe("partial");
  });

  it("sin slot id en la prescripción, cada log se consume una sola vez", () => {
    const legacyPrescription = [
      prescribedSlot({ prescribedSets: 4 }),
      prescribedSlot({ prescribedSets: 3 }),
    ];
    const result = computeDayAdherence(legacyPrescription, [
      log({ session_exercise_id: "se-a", setCount: 4 }),
    ]);

    expect(result.loggedSetsTotal).toBe(4);
    expect(result.completedExercises).toBe(1);
    expect(result.hasOverage).toBe(false);
  });

  it("dos grupos de logs sin ids en la prescripción se reparten en orden", () => {
    const legacyPrescription = [
      prescribedSlot({ prescribedSets: 4 }),
      prescribedSlot({ prescribedSets: 3 }),
    ];
    const result = computeDayAdherence(legacyPrescription, [
      log({ id: "log-a", session_exercise_id: "se-a", setCount: 4 }),
      log({ id: "log-b", session_exercise_id: "se-b", setCount: 3 }),
    ]);

    expect(result.loggedSetsTotal).toBe(7);
    expect(result.completedExercises).toBe(2);
    expect(classifyDay(true, result, false, false)).toBe("complete");
  });

  it("ambos slots registrados con ids exactos → día completo", () => {
    const result = computeDayAdherence(twoSlots, [
      log({ id: "log-a", session_exercise_id: "se-a", setCount: 4 }),
      log({ id: "log-b", session_exercise_id: "se-b", setCount: 3 }),
    ]);

    expect(result.loggedSetsTotal).toBe(7);
    expect(result.completedExercises).toBe(2);
    expect(classifyDay(true, result, false, false)).toBe("complete");
  });

  it("log legacy sin slot id cae al fallback por exercise_id", () => {
    const result = computeDayAdherence(
      [prescribedSlot({ sessionExerciseId: "se-a", prescribedSets: 4 })],
      [log({ setCount: 4 })]
    );

    expect(result.loggedSetsTotal).toBe(4);
    expect(result.completedExercises).toBe(1);
  });
});

describe("classificationLabel", () => {
  it("traduce a las palabras del selector", () => {
    expect(classificationLabel("complete")).toBe("Hecho");
    expect(classificationLabel("partial")).toBe("Empezado");
    expect(classificationLabel("pending")).toBe("Sin hacer");
    expect(classificationLabel("rest")).toBe("");
    expect(classificationLabel("future")).toBe("");
  });
});
