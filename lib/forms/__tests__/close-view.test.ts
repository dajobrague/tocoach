import { describe, expect, it } from "vitest";

import { fromCloseView, toCloseView } from "../schedule";

describe("close view ⇄ stored schedule", () => {
  it("lunes 12:00 + 48h = cierra miércoles 12:00", () => {
    expect(
      toCloseView({ days_of_week: [1], time: "12:00", grace_period_hours: 48 })
    ).toEqual({ closeDays: [3], closeTime: "12:00", marginHours: 48 });
  });

  it("cierre lunes 10:00 con 3 días de margen abre el viernes", () => {
    expect(
      fromCloseView({ closeDays: [1], closeTime: "10:00", marginHours: 72 })
    ).toEqual({ days_of_week: [5], time: "10:00", grace_period_hours: 72 });
  });

  it("cruza el domingo en varios días y plazos legacy no múltiplos de 24", () => {
    const stored = {
      days_of_week: [0, 4],
      time: "20:30",
      grace_period_hours: 36,
    };
    const view = toCloseView(stored);

    expect(view).toEqual({
      closeDays: [2, 6],
      closeTime: "8:30",
      marginHours: 36,
    });
    expect(fromCloseView(view)).toEqual(stored);
  });

  it("round-trip estable para todos los días y márgenes de 1–7 días", () => {
    for (let dow = 0; dow < 7; dow++) {
      for (let days = 1; days <= 7; days++) {
        const view = {
          closeDays: [dow],
          closeTime: "23:15",
          marginHours: days * 24,
        };

        expect(toCloseView(fromCloseView(view))).toEqual(view);
      }
    }
  });
});
