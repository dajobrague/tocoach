import { describe, expect, it } from "vitest";

import {
  checkInReminderDue,
  getCheckInStatus,
  getScheduleOrDefault,
  getUpcomingCheckIns,
  isDueNow,
  setCheckInException,
} from "../schedule";

// Lunes 12:00 Europe/Madrid, 48 h de margen, cada semana.
const weekly = {
  frequency: "weekly" as const,
  days_of_week: [1],
  time: "12:00",
  timezone: "Europe/Madrid",
  grace_period_hours: 48,
  enabled: true,
};

describe("getUpcomingCheckIns", () => {
  it("sin ventana abierta: las siguientes aperturas, una por semana", () => {
    // Jueves 12 nov 2026.
    const out = getUpcomingCheckIns(
      weekly,
      3,
      new Date("2026-11-12T10:00:00Z")
    );

    expect(out.map((o) => o.opensAt.toISOString())).toEqual([
      "2026-11-16T11:00:00.000Z",
      "2026-11-23T11:00:00.000Z",
      "2026-11-30T11:00:00.000Z",
    ]);
    expect(out[0]?.closesAt.toISOString()).toBe("2026-11-18T11:00:00.000Z");
  });

  it("con ventana abierta: va primero y no se repite", () => {
    // Martes 10 nov 2026: dentro de la ventana que abrió el lunes 9.
    const out = getUpcomingCheckIns(
      weekly,
      2,
      new Date("2026-11-10T10:00:00Z")
    );

    expect(out.map((o) => o.opensAt.toISOString())).toEqual([
      "2026-11-09T11:00:00.000Z",
      "2026-11-16T11:00:00.000Z",
    ]);
  });

  it("desactivado: vacío", () => {
    expect(getUpcomingCheckIns({ ...weekly, enabled: false }, 3)).toEqual([]);
  });
});

describe("primer check-in elegido por el entrenador", () => {
  // Cierra los miércoles 12:00 (abre lunes 12:00 + 48 h), cada 2 semanas.
  const biweekly = { ...weekly, interval_weeks: 2 };
  const closes = (s: object, now: string) =>
    getUpcomingCheckIns(s, 3, new Date(now)).map((o) =>
      o.closesAt.toISOString().slice(0, 10)
    );

  it("nada cierra antes de la fecha y cuenta cada 2 semanas desde ella", () => {
    expect(
      closes(
        { ...biweekly, first_close_date: "2026-11-25" },
        "2026-11-12T10:00:00Z"
      )
    ).toEqual(["2026-11-25", "2026-12-09", "2026-12-23"]);
  });

  it("la semana contraria también vale: depende de la fecha, no del calendario global", () => {
    expect(
      closes(
        { ...biweekly, first_close_date: "2026-11-18" },
        "2026-11-12T10:00:00Z"
      )
    ).toEqual(["2026-11-18", "2026-12-02", "2026-12-16"]);
  });

  it("fecha que no cae en día de cierre: el primero es el siguiente cierre", () => {
    expect(
      closes(
        { ...weekly, first_close_date: "2026-11-20" },
        "2026-11-12T10:00:00Z"
      )
    ).toEqual(["2026-11-25", "2026-12-02", "2026-12-09"]);
  });

  it("primer check-in a muchos meses vista", () => {
    expect(
      closes(
        { ...biweekly, first_close_date: "2027-09-01" },
        "2026-11-12T10:00:00Z"
      )[0]
    ).toBe("2027-09-01");
  });

  it("sin fecha: igual que antes", () => {
    expect(closes(weekly, "2026-11-12T10:00:00Z")).toEqual([
      "2026-11-18",
      "2026-11-25",
      "2026-12-02",
    ]);
  });
});

describe("mover o quitar un check-in concreto", () => {
  const now = new Date("2026-11-12T10:00:00Z");
  const closes = (s: Parameters<typeof getUpcomingCheckIns>[0]) =>
    getUpcomingCheckIns(s, 3, now).map((o) =>
      o.closesAt.toISOString().slice(0, 10)
    );
  const base = getScheduleOrDefault(weekly);

  it("quitar uno: desaparece y el resto sigue igual", () => {
    expect(closes(setCheckInException(base, "2026-11-25", null))).toEqual([
      "2026-11-18",
      "2026-12-02",
      "2026-12-09",
    ]);
  });

  it("mover uno: cambia solo ese, con la misma hora", () => {
    const moved = setCheckInException(base, "2026-11-25", "2026-11-27");
    const out = getUpcomingCheckIns(moved, 3, now);

    expect(out.map((o) => o.closesAt.toISOString())).toEqual([
      "2026-11-18T11:00:00.000Z",
      "2026-11-27T11:00:00.000Z",
      "2026-12-02T11:00:00.000Z",
    ]);
    // El aviso (cron) sale el día de la nueva apertura, no el de la regla.
    expect(isDueNow(moved, new Date("2026-11-25T11:00:00Z"))).toBe(true);
    expect(isDueNow(moved, new Date("2026-11-23T11:00:00Z"))).toBe(false);
  });

  it("mover uno ya movido actualiza la misma excepción; restaurar la borra", () => {
    const once = setCheckInException(base, "2026-11-25", "2026-11-27");
    const twice = setCheckInException(once, "2026-11-27", "2026-11-28");

    expect(twice.exceptions).toEqual({ "2026-11-25": "2026-11-28" });
    expect(
      setCheckInException(twice, "2026-11-28", undefined).exceptions
    ).toEqual({});
  });
});

describe("avisos del cron horario", () => {
  // Abre lunes 12:30 Madrid (11:30Z): minuto que el cron antiguo nunca veía.
  const s = { ...weekly, time: "12:30" };
  const at = (iso: string) => checkInReminderDue(s, new Date(iso));

  it("avisa de la apertura en la primera pasada tras abrir, una sola vez", () => {
    expect(at("2026-11-16T11:00:00Z")).toBeNull();
    expect(at("2026-11-16T12:00:00Z")?.kind).toBe("opened");
    expect(at("2026-11-16T13:00:00Z")).toBeNull();
  });

  it("avisa del cierre 24 h antes, una sola vez", () => {
    // Cierra miércoles 18 a las 11:30Z.
    expect(at("2026-11-17T11:00:00Z")).toBeNull();
    expect(at("2026-11-17T12:00:00Z")?.kind).toBe("closing");
    expect(at("2026-11-17T13:00:00Z")).toBeNull();
  });
});

describe("check-in sin enviar", () => {
  const now = new Date("2026-11-20T10:00:00Z"); // viernes; cerró el miércoles 18

  it("la última ventana cerrada sin respuesta → expired", () => {
    expect(getCheckInStatus(weekly, [], now)).toBe("expired");
  });

  it("con respuesta (aunque llegue tarde) → not_due", () => {
    expect(
      getCheckInStatus(weekly, [{ submitted_at: "2026-11-19T09:00:00Z" }], now)
    ).toBe("not_due");
  });

  it("cliente dado de alta después de esa apertura → not_due", () => {
    expect(
      getCheckInStatus(weekly, [], now, new Date("2026-11-19T00:00:00Z"))
    ).toBe("not_due");
  });
});
