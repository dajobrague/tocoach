import type { DayMetrics, SessionEntry } from "./types";

import { describe, expect, it } from "vitest";

import { dayLabelClassification } from "./day-label";

function session(
  classification: SessionEntry["classification"],
  id = "real-1"
): SessionEntry {
  return { classification, scheduledSession: { id } } as SessionEntry;
}

function day(
  sessions: SessionEntry[],
  over: Partial<DayMetrics> = {}
): DayMetrics {
  return {
    date: "2026-07-28",
    sessions,
    recommendedSessions: [],
    recommendedSessionNames: [],
    isToday: false,
    isFuture: false,
    ...over,
  };
}

describe("dayLabelClassification — regla compartida semana/mes", () => {
  it("Hecho solo cuando TODAS las sesiones no-futuras están completas", () => {
    expect(dayLabelClassification(day([session("complete")]))).toBe("complete");
    expect(
      dayLabelClassification(day([session("complete"), session("complete")]))
    ).toBe("complete");
    expect(
      dayLabelClassification(day([session("complete"), session("pending")]))
    ).toBe("partial");
  });

  it("sugerencia de plantilla sin tocar no quita el Hecho si entrenó otra sesión", () => {
    expect(
      dayLabelClassification(
        day([session("pending", "template:a"), session("complete")])
      )
    ).toBe("complete");
    // Sin ninguna sesión real completa sigue contando.
    expect(
      dayLabelClassification(
        day([session("pending", "template:a"), session("partial")])
      )
    ).toBe("partial");
  });

  it("cualquier actividad sin completar todo → Empezado", () => {
    expect(dayLabelClassification(day([session("partial")]))).toBe("partial");
  });

  it("sesiones prescritas sin actividad → Sin hacer", () => {
    expect(dayLabelClassification(day([session("pending")]))).toBe("pending");
  });

  it("descanso y futuro no llevan palabra", () => {
    expect(dayLabelClassification(day([]))).toBe("rest");
    expect(dayLabelClassification(day([], { isFuture: true }))).toBe("future");
    expect(dayLabelClassification(day([session("future")]))).toBe("future");
  });
});
