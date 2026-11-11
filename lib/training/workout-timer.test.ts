import { describe, expect, it } from "vitest";

import {
  EMPTY_TIMER_LOCAL,
  REST_FINISHED_VISIBLE_MS,
  clearRest,
  elapsedMs,
  extendRest,
  formatClock,
  parseTimerLocal,
  pauseTimer,
  restPhase,
  resumeTimer,
  sessionStartMs,
  startRest,
} from "./workout-timer";

describe("sessionStartMs", () => {
  it("combina fecha y HH:MM en hora local", () => {
    expect(sessionStartMs("2026-11-04", "09:30")).toBe(
      new Date(2026, 10, 4, 9, 30).getTime()
    );
    expect(sessionStartMs("2026-11-04", "09:30:00")).toBe(
      new Date(2026, 10, 4, 9, 30).getTime()
    );
  });

  it("null sin hora o con formato roto", () => {
    expect(sessionStartMs("2026-11-04", null)).toBeNull();
    expect(sessionStartMs("2026-11-04", "")).toBeNull();
    expect(sessionStartMs("4/11/2026", "09:30")).toBeNull();
  });
});

describe("cronómetro con pausas", () => {
  const start = 1_000_000;

  it("cuenta desde el inicio y nunca es negativo", () => {
    expect(elapsedMs(start, EMPTY_TIMER_LOCAL, start + 65_000)).toBe(65_000);
    // Hora de inicio editada al futuro.
    expect(elapsedMs(start, EMPTY_TIMER_LOCAL, start - 5_000)).toBe(0);
  });

  it("pausar congela y reanudar descuenta lo pausado", () => {
    let s = pauseTimer(EMPTY_TIMER_LOCAL, start + 60_000);

    expect(elapsedMs(start, s, start + 600_000)).toBe(60_000);
    // Pausar dos veces no mueve el instante de pausa.
    expect(pauseTimer(s, start + 90_000)).toBe(s);

    s = resumeTimer(s, start + 120_000);
    expect(s.pausedAt).toBeNull();
    expect(s.pausedMs).toBe(60_000);
    expect(elapsedMs(start, s, start + 180_000)).toBe(120_000);
    expect(resumeTimer(s, start + 200_000)).toBe(s);
  });
});

describe("descanso", () => {
  const now = 5_000_000;

  it("corre, se alarga +15 s y termina", () => {
    let s = startRest(EMPTY_TIMER_LOCAL, 90, now);

    expect(restPhase(s, now + 30_000)).toEqual({
      kind: "running",
      remainingMs: 60_000,
    });
    s = extendRest(s, now + 30_000);
    expect(restPhase(s, now + 30_000)).toEqual({
      kind: "running",
      remainingMs: 75_000,
    });
    expect(restPhase(s, now + 105_000)).toEqual({ kind: "finished" });
  });

  it("+15 s no revive un descanso terminado", () => {
    const s = startRest(EMPTY_TIMER_LOCAL, 60, now);

    expect(extendRest(s, now + 61_000)).toBe(s);
    expect(extendRest(EMPTY_TIMER_LOCAL, now)).toBe(EMPTY_TIMER_LOCAL);
  });

  it("el aviso de terminado caduca y se puede quitar", () => {
    const s = startRest(EMPTY_TIMER_LOCAL, 60, now);

    expect(restPhase(s, now + 60_000 + REST_FINISHED_VISIBLE_MS + 1).kind).toBe(
      "idle"
    );
    expect(restPhase(clearRest(s), now + 61_000).kind).toBe("idle");
  });
});

describe("formatClock", () => {
  it("m:ss y h:mm:ss", () => {
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(75_400)).toBe("1:15");
    expect(formatClock(3_725_000)).toBe("1:02:05");
  });

  it("la cuenta atrás redondea arriba (no enseña 0:00 antes de acabar)", () => {
    expect(formatClock(400, true)).toBe("0:01");
    expect(formatClock(59_001, true)).toBe("1:00");
  });
});

describe("parseTimerLocal", () => {
  it("tolera vacío, basura y campos inválidos", () => {
    expect(parseTimerLocal(null)).toEqual(EMPTY_TIMER_LOCAL);
    expect(parseTimerLocal("{no json")).toEqual(EMPTY_TIMER_LOCAL);
    expect(
      parseTimerLocal(
        JSON.stringify({ pausedAt: "x", pausedMs: -5, restEndsAt: 42 })
      )
    ).toEqual({
      pausedAt: null,
      pausedMs: 0,
      restEndsAt: 42,
      restSeconds: null,
    });
  });
});
