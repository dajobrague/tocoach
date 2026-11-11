import { describe, expect, it } from "vitest";

import {
  addDays,
  mondayOf,
  rosterGrowth,
  sessionsByDay,
  weeklyCheckIns,
} from "./stats";

import { getScheduleOrDefault } from "@/lib/forms/schedule";

describe("fechas", () => {
  it("el lunes de un miércoles y de un domingo", () => {
    expect(mondayOf("2026-11-11")).toBe("2026-11-09");
    expect(mondayOf("2026-11-15")).toBe("2026-11-09");
    expect(mondayOf("2026-11-09")).toBe("2026-11-09");
    expect(addDays("2026-11-30", 2)).toBe("2026-12-02");
  });
});

describe("sessionsByDay", () => {
  it("reparte por día y cuenta hechas", () => {
    const days = sessionsByDay(
      [
        { scheduled_date: "2026-11-09", status: "completed" },
        { scheduled_date: "2026-11-09", status: "scheduled" },
        { scheduled_date: "2026-11-11", status: "completed" },
        { scheduled_date: "2026-11-16", status: "completed" }, // otra semana
      ],
      "2026-11-09"
    );

    expect(days[0]).toEqual({ done: 1, planned: 2 });
    expect(days[2]).toEqual({ done: 1, planned: 1 });
    expect(days.reduce((n, d) => n + d.planned, 0)).toBe(3);
  });
});

describe("weeklyCheckIns", () => {
  // Abre lunes 12:00 Madrid, 48 h → cierra miércoles. Cada semana.
  const schedule = getScheduleOrDefault({
    days_of_week: [1],
    time: "12:00",
    timezone: "Europe/Madrid",
    grace_period_hours: 48,
  });
  const now = new Date("2026-11-12T10:00:00Z"); // jueves

  it("uno por semana; recibido solo donde hay respuesta", () => {
    const stats = weeklyCheckIns(
      schedule,
      [
        { submitted_at: "2026-11-10T09:00:00Z" }, // esta semana
        { submitted_at: "2026-10-29T09:00:00Z" }, // tarde, semana del 26 oct
      ],
      now,
      4
    );

    expect(stats.map((w) => w.due)).toEqual([1, 1, 1, 1]);
    expect(stats.map((w) => w.received)).toEqual([0, 1, 0, 1]);
  });

  it("lo que abrió antes del alta no cuenta", () => {
    const stats = weeklyCheckIns(
      schedule,
      [],
      now,
      4,
      new Date("2026-11-05T00:00:00Z").getTime()
    );

    expect(stats.map((w) => w.due)).toEqual([0, 0, 0, 1]);
  });
});

describe("rosterGrowth", () => {
  it("cuenta los ya dados de alta al cierre de cada semana", () => {
    expect(
      rosterGrowth(["2026-01-01", "2026-11-03", "2026-11-10"], "2026-11-09", 3)
    ).toEqual([1, 2, 3]);
  });
});
