import { describe, expect, it } from "vitest";

import {
  addDays,
  buildMonthGrid,
  firstOfMonth,
  monthTitle,
  shiftMonth,
} from "../calendar-helpers";
import { buildCreateBody, scopeLabel } from "../overrides-api";

/** Pure helpers for the trainer calendar overlay (no DOM). */

describe("calendar-helpers — date math", () => {
  it("adds days across a month boundary", () => {
    expect(addDays("2026-06-30", 1)).toBe("2026-07-01");
    expect(addDays("2026-06-01", -1)).toBe("2026-05-31");
  });

  it("firstOfMonth / shiftMonth", () => {
    expect(firstOfMonth("2026-06-15")).toBe("2026-06-01");
    expect(shiftMonth("2026-06-01", 1)).toBe("2026-07-01");
    expect(shiftMonth("2026-01-01", -1)).toBe("2025-12-01");
  });

  it("monthTitle is the Spanish month + year", () => {
    expect(monthTitle("2026-06-10")).toBe("junio 2026");
  });
});

describe("buildMonthGrid", () => {
  it("starts each week on Monday and covers the whole month", () => {
    const weeks = buildMonthGrid("2026-06-10"); // June 2026: 1st is a Monday
    const flat = weeks.flat();

    // Every row is 7 days; first cell is a Monday (UTC getUTCDay === 1).
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(new Date(`${flat[0]!.date}T00:00:00Z`).getUTCDay()).toBe(1);

    // The month's 1st and last day are present and marked in-month.
    const june1 = flat.find((d) => d.date === "2026-06-01");
    const june30 = flat.find((d) => d.date === "2026-06-30");

    expect(june1?.inMonth).toBe(true);
    expect(june30?.inMonth).toBe(true);
    // A trailing July day is padding (not in-month).
    expect(flat.find((d) => d.date === "2026-07-01")?.inMonth).toBe(false);
  });

  it("pads the leading week when the 1st is not a Monday", () => {
    const weeks = buildMonthGrid("2026-07-15"); // July 1 2026 is a Wednesday
    const firstCell = weeks[0]![0]!;

    // Leading padding belongs to June and is marked out-of-month.
    expect(firstCell.date < "2026-07-01").toBe(true);
    expect(firstCell.inMonth).toBe(false);
  });
});

describe("buildCreateBody / scopeLabel", () => {
  it("builds a single_day note body", () => {
    expect(
      buildCreateBody({
        overrideType: "note",
        scope: "single_day",
        anchorDate: "2026-06-10",
        dayIndex: null,
        noteText: "Bebe agua",
      })
    ).toEqual({
      overrideType: "note",
      scope: "single_day",
      anchorDate: "2026-06-10",
      noteText: "Bebe agua",
    });
  });

  it("includes dayIndex only for every_cycle", () => {
    const body = buildCreateBody({
      overrideType: "note",
      scope: "every_cycle",
      anchorDate: "2026-06-10",
      dayIndex: 2,
      noteText: "x",
    });

    expect(body.dayIndex).toBe(2);
  });

  it("builds a recipe swap body", () => {
    expect(
      buildCreateBody({
        overrideType: "swap",
        scope: "day_forward",
        anchorDate: "2026-06-10",
        dayIndex: null,
        slotId: "slot-1",
        swapItems: [{ kind: "recipe", recipeId: "r-1" }],
      })
    ).toEqual({
      overrideType: "swap",
      scope: "day_forward",
      anchorDate: "2026-06-10",
      slotId: "slot-1",
      swapItems: [{ swapSourceType: "recipe", swapSourceRefId: "r-1" }],
    });
  });

  it("builds a multi-item food swap body with quantities", () => {
    const body = buildCreateBody({
      overrideType: "swap",
      scope: "single_day",
      anchorDate: "2026-06-10",
      dayIndex: null,
      slotId: "slot-1",
      swapItems: [
        { kind: "food", ingredientId: "i-1", quantity: 150 },
        { kind: "food", ingredientId: "i-2", quantity: 80 },
      ],
    });

    expect(body.swapItems).toEqual([
      { swapSourceType: "food", swapSourceRefId: "i-1", swapQuantity: 150 },
      { swapSourceType: "food", swapSourceRefId: "i-2", swapQuantity: 80 },
    ]);
  });

  it("scopeLabel is human-readable", () => {
    expect(scopeLabel("single_day")).toBe("Solo este día");
    expect(scopeLabel("day_forward")).toBe("Este día en adelante");
  });
});
