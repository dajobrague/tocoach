import { describe, expect, it } from "vitest";

import { parseActiveTraining } from "../hooks/use-persisted-active-training";

// Regresión: el par {date, sessionId} persistido en localStorage no
// expiraba nunca. Un cliente que entrenó el lunes y nunca tocó "Cambiar
// entrenamiento" abría la pestaña Entrenamiento el miércoles y la app
// restauraba el LUNES (fecha + sesión activa) en vez de abrir en hoy.

const TODAY = "2026-06-12";

describe("parseActiveTraining", () => {
  it("restores a same-day active training", () => {
    const raw = JSON.stringify({ date: TODAY, sessionId: "s-1" });

    expect(parseActiveTraining(raw, TODAY)).toEqual({
      date: TODAY,
      sessionId: "s-1",
    });
  });

  it("discards a stale persisted day (client trained on a previous day)", () => {
    const raw = JSON.stringify({ date: "2026-06-10", sessionId: "s-1" });

    expect(parseActiveTraining(raw, TODAY)).toBeNull();
  });

  it("discards a future persisted day", () => {
    const raw = JSON.stringify({ date: "2026-06-13", sessionId: "s-1" });

    expect(parseActiveTraining(raw, TODAY)).toBeNull();
  });

  it("discards malformed payloads", () => {
    expect(parseActiveTraining(null, TODAY)).toBeNull();
    expect(parseActiveTraining("not-json", TODAY)).toBeNull();
    expect(parseActiveTraining(JSON.stringify({ date: TODAY }), TODAY)).toBe(
      null
    );
    expect(
      parseActiveTraining(JSON.stringify({ sessionId: "s-1" }), TODAY)
    ).toBeNull();
  });
});
