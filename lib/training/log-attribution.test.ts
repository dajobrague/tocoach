import { describe, it, expect } from "vitest";

import { logMatchesSlot, type AttributableLog } from "./log-attribution";

// Scenario: "Plank" (one library exercise) appears in two sessions on the
// same day — Monday-Push (slotA) and Wednesday-Pull (slotB) — and once more in
// a second slot of Monday-Push (slotA2). Sessions are identified by their
// template session id.
const PLANK = "ex-plank";
const SQUAT = "ex-squat";
const MON = "session-monday";
const WED = "session-wednesday";
const slotA = "se-plank-monday";
const slotA2 = "se-plank-monday-2";
const slotB = "se-plank-wednesday";

const plannedMonday = { exercise_id: PLANK, session_exercise_id: slotA };
const plannedMonday2 = { exercise_id: PLANK, session_exercise_id: slotA2 };
const plannedWednesday = { exercise_id: PLANK, session_exercise_id: slotB };

function log(partial: Partial<AttributableLog>): AttributableLog {
  return { exercise_id: PLANK, session_id: MON, ...partial };
}

describe("logMatchesSlot — the false-done fix", () => {
  describe("precise slot attribution (new/backfilled logs)", () => {
    it("a log for slotA marks slotA done", () => {
      const l = log({ session_exercise_id: slotA });

      expect(logMatchesSlot(l, plannedMonday, MON)).toBe(true);
    });

    it("THE BUG: a log for slotA does NOT mark slotB (same exercise, other session)", () => {
      const l = log({ session_exercise_id: slotA });

      expect(logMatchesSlot(l, plannedWednesday, WED)).toBe(false);
    });

    it("THE BUG: a log for slotA does NOT mark slotA2 (same exercise twice in one session)", () => {
      const l = log({ session_exercise_id: slotA });

      expect(logMatchesSlot(l, plannedMonday2, MON)).toBe(false);
    });

    it("logging slotA2 then marks slotA2 (both must be logged independently)", () => {
      const l = log({ session_exercise_id: slotA2 });

      expect(logMatchesSlot(l, plannedMonday2, MON)).toBe(true);
      expect(logMatchesSlot(l, plannedMonday, MON)).toBe(false);
    });
  });

  describe("legacy logs (no session_exercise_id) — no false negatives", () => {
    it("a legacy log marks the matching slot in its OWN session", () => {
      const l = log({ session_exercise_id: null, session_id: MON });

      expect(logMatchesSlot(l, plannedMonday, MON)).toBe(true);
    });

    it("a legacy log does NOT bleed into a different same-day session", () => {
      const l = log({ session_exercise_id: null, session_id: WED });

      expect(logMatchesSlot(l, plannedMonday, MON)).toBe(false);
    });

    it("a legacy log with no session_id still attributes by exercise_id (permissive)", () => {
      const l = log({ session_exercise_id: null, session_id: null });

      expect(logMatchesSlot(l, plannedMonday, MON)).toBe(true);
    });

    it("a legacy log for a DIFFERENT exercise never matches", () => {
      const l = log({ exercise_id: SQUAT, session_exercise_id: null });

      expect(logMatchesSlot(l, plannedMonday, MON)).toBe(false);
    });
  });

  describe("deleted-slot logs (FK ON DELETE SET NULL → session_exercise_id becomes null)", () => {
    it("degrades to the legacy exercise_id fallback (still marks done)", () => {
      // Trainer deleted & re-created the slot; the old log's slot id was nulled.
      const l = log({ session_exercise_id: null, session_id: MON });

      expect(logMatchesSlot(l, plannedMonday, MON)).toBe(true);
    });
  });

  describe("off-plan extras (planned exercise has no slot id)", () => {
    const offPlan = { exercise_id: PLANK }; // session_exercise_id undefined

    it("matches by exercise_id regardless of the log's slot", () => {
      expect(
        logMatchesSlot(log({ session_exercise_id: slotB }), offPlan, MON)
      ).toBe(true);
      expect(
        logMatchesSlot(log({ session_exercise_id: null }), offPlan, MON)
      ).toBe(true);
    });

    it("does not match a different exercise", () => {
      const l = log({ exercise_id: SQUAT });

      expect(logMatchesSlot(l, offPlan, MON)).toBe(false);
    });
  });
});
