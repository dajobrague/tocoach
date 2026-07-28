import type { DayAdherence } from "./types";

import { describe, expect, it } from "vitest";

import { classificationLabel, classifyDay } from "./adherence";

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
