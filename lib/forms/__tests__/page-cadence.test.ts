import type { FormConfigData } from "../types";

import { describe, expect, it } from "vitest";

import { dropPagesNotDue, isPageDue } from "../page-cadence";
import { DEFAULT_CHECKIN_SCHEDULE } from "../schedule";

// Weekly on Mondays, UTC, no grace — periods start on Monday 00:00.
const weekly = {
  ...DEFAULT_CHECKIN_SCHEDULE,
  days_of_week: [1],
  time: "00:00",
  timezone: "UTC",
  grace_period_hours: 0,
};

// Four consecutive Mondays.
const MONDAYS = [
  "2026-09-07",
  "2026-09-14",
  "2026-09-21",
  "2026-09-28",
  "2026-10-05",
].map((ymd) => new Date(`${ymd}T10:00:00Z`));

describe("isPageDue", () => {
  it("is always due without every_n or with every_n = 1", () => {
    for (const now of MONDAYS) {
      expect(isPageDue({}, weekly, now)).toBe(true);
      expect(isPageDue({ every_n: 1 }, weekly, now)).toBe(true);
    }
  });

  it("an every_n = 2 page shows on alternate weekly periods", () => {
    const due = MONDAYS.map((now) => isPageDue({ every_n: 2 }, weekly, now));

    expect(due).toEqual([due[0], !due[0], due[0], !due[0], due[0]]);
  });

  it("stays constant inside one period", () => {
    const monday = MONDAYS[1]!;
    const thursday = new Date(monday.getTime() + 3 * 86_400_000);

    expect(isPageDue({ every_n: 4 }, weekly, thursday)).toBe(
      isPageDue({ every_n: 4 }, weekly, monday)
    );
  });
});

describe("dropPagesNotDue", () => {
  const config: FormConfigData = {
    pages: [
      { id: "short", title: "Semanal", icon: "x", order: 0 },
      { id: "long", title: "Mensual", icon: "x", order: 1, every_n: 2 },
    ],
    questions: [
      {
        id: "weight",
        label: "Peso",
        icon: "x",
        type: "number",
        enabled: true,
        required: true,
        pageId: "short",
      },
      {
        id: "photo",
        label: "Foto",
        icon: "x",
        type: "photo",
        enabled: true,
        required: true,
        pageId: "long",
      },
      {
        id: "legacy",
        label: "Sin página",
        icon: "x",
        type: "text",
        enabled: true,
        required: false,
      },
    ],
  };

  it("removes off-cadence pages and their questions, keeps first-page fallbacks", () => {
    const offWeek = MONDAYS.find(
      (now) => isPageDue({ every_n: 2 }, weekly, now) === false
    )!;
    const trimmed = dropPagesNotDue(config, weekly, offWeek);

    expect(trimmed.pages.map((p) => p.id)).toEqual(["short"]);
    expect(trimmed.questions.map((q) => q.id)).toEqual(["weight", "legacy"]);
  });

  it("returns the same config object when every page is due", () => {
    const onWeek = MONDAYS.find((now) =>
      isPageDue({ every_n: 2 }, weekly, now)
    )!;

    expect(dropPagesNotDue(config, weekly, onWeek)).toBe(config);
  });
});
