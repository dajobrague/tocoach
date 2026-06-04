import { describe, expect, it } from "vitest";

import { parseCreateOverride, parseUpdateOverride } from "../override-request";

/** Validation of the override create/update bodies (type×scope shape rules). */

function ok<T>(result: { ok: boolean; value?: T; error?: string }): T {
  if (result.ok === false) {
    throw new Error(`expected ok, got error: ${result.error}`);
  }

  return result.value as T;
}

describe("parseCreateOverride — notes", () => {
  it("accepts a single_day note", () => {
    const value = ok(
      parseCreateOverride({
        overrideType: "note",
        scope: "single_day",
        anchorDate: "2026-06-03",
        noteText: "  Bebe más agua  ",
      })
    );

    expect(value.overrideType).toBe("note");
    expect(value.noteText).toBe("Bebe más agua");
    expect(value.slotId).toBeNull();
  });

  it("rejects a note with no text", () => {
    const result = parseCreateOverride({
      overrideType: "note",
      scope: "single_day",
      anchorDate: "2026-06-03",
    });

    expect(result.ok).toBe(false);
  });
});

describe("parseCreateOverride — swaps", () => {
  it("accepts a swap with slot + frozen source fields", () => {
    const value = ok(
      parseCreateOverride({
        overrideType: "swap",
        scope: "day_forward",
        anchorDate: "2026-06-03",
        slotId: "slot-1",
        swapSourceType: "recipe",
        swapSourceRefId: "recipe-1",
      })
    );

    expect(value.slotId).toBe("slot-1");
    expect(value.swapSourceType).toBe("recipe");
    expect(value.swapSourceRefId).toBe("recipe-1");
  });

  it("rejects a swap missing its slot", () => {
    const result = parseCreateOverride({
      overrideType: "swap",
      scope: "single_day",
      anchorDate: "2026-06-03",
      swapSourceType: "recipe",
      swapSourceRefId: "recipe-1",
    });

    expect(result.ok).toBe(false);
  });

  it("rejects a swap with an invalid source type", () => {
    const result = parseCreateOverride({
      overrideType: "swap",
      scope: "single_day",
      anchorDate: "2026-06-03",
      slotId: "slot-1",
      swapSourceType: "drink",
      swapSourceRefId: "recipe-1",
    });

    expect(result.ok).toBe(false);
  });
});

describe("parseCreateOverride — scope / date validation", () => {
  it("requires dayIndex for every_cycle", () => {
    const missing = parseCreateOverride({
      overrideType: "note",
      scope: "every_cycle",
      anchorDate: "2026-06-03",
      noteText: "hi",
    });

    expect(missing.ok).toBe(false);

    const value = ok(
      parseCreateOverride({
        overrideType: "note",
        scope: "every_cycle",
        anchorDate: "2026-06-03",
        dayIndex: 0,
        noteText: "hi",
      })
    );

    expect(value.dayIndex).toBe(0);
  });

  it("rejects an unknown scope and a bad date", () => {
    expect(
      parseCreateOverride({
        overrideType: "note",
        scope: "forever",
        anchorDate: "2026-06-03",
        noteText: "hi",
      }).ok
    ).toBe(false);
    expect(
      parseCreateOverride({
        overrideType: "note",
        scope: "single_day",
        anchorDate: "2026-13-40",
        noteText: "hi",
      }).ok
    ).toBe(false);
  });
});

describe("parseUpdateOverride", () => {
  it("accepts a partial note-text update", () => {
    const value = ok(parseUpdateOverride({ noteText: "nuevo texto" }));

    expect(value.noteText).toBe("nuevo texto");
  });

  it("rejects switching scope to every_cycle without a dayIndex", () => {
    expect(parseUpdateOverride({ scope: "every_cycle" }).ok).toBe(false);
    expect(parseUpdateOverride({ scope: "every_cycle", dayIndex: 2 }).ok).toBe(
      true
    );
  });
});
