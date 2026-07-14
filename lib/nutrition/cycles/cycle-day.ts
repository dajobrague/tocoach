import type {
  CycleStatus,
  MealCycleTree,
  MealSlotWithOptions,
} from "./meal-cycle-service";
import type { ClientSelection } from "./option-selection";
import type {
  MealLogRow,
  MealLogStatus,
} from "@/lib/nutrition/logs/meal-log-service";

import { toYmdInTimezone } from "@/lib/forms/chart-helpers";

/**
 * Pure cycle-day math + projection for the client's "today" view (P4).
 *
 * Deterministic and timezone-correct: "today" is resolved to a calendar day in
 * the client's IANA timezone (via the shared `toYmdInTimezone`), then compared
 * to the cycle's `start_date` (a tz-less DATE) as calendar days. So a client
 * just past midnight in Pacific/Auckland and one still on the previous day in
 * America/Los_Angeles see different cycle days for the same instant. Defaults to
 * "UTC" when no timezone is supplied. No DB access — the route hands these
 * helpers the already-fetched (snapshot-backed) tree.
 */

const MS_PER_DAY = 86_400_000;

/** Where "today" falls in a cycle's rotation. */
export interface CycleDayPosition {
  /** True once today is on or after the cycle's start date. */
  started: boolean;
  /** 0-based day within the rotation; `null` before the cycle starts. */
  dayIndex: number | null;
}

/** One rotation day with its ordered meal slots. */
export interface CycleDay {
  dayIndex: number;
  slots: MealSlotWithOptions[];
}

/** The shape the client portal consumes — no live recipe-library links. */
export interface ClientCycleView {
  cycle: {
    id: string;
    name: string;
    durationDays: number;
    startDate: string;
    status: CycleStatus;
  } | null;
  /** ISO date (YYYY-MM-DD) the position was computed against. */
  today: string;
  /** Where today falls; `null` when there is no active cycle. */
  position: CycleDayPosition | null;
  /** Slots grouped by rotation day; `[]` when there is no active cycle. */
  days: CycleDay[];
  /** The client's standing choice per slot (slotId → optionId). */
  selections: Record<string, string>;
  /** The client's log for each slot, for TODAY only (slotId → log). */
  logs: Record<string, ClientMealLog>;
  /** Trainer notes that apply to TODAY (date-level + slot-level), P7. */
  notes: ClientDayNote[];
}

/** A trainer override note surfaced on the client's day. */
export interface ClientDayNote {
  id: string;
  /** The slot it attaches to, or `null` for a whole-day note. */
  slotId: string | null;
  text: string;
}

/** A client's meal log as the today view consumes it (camelCase, today only). */
export interface ClientMealLog {
  status: MealLogStatus;
  optionId: string | null;
  comment: string | null;
  photoUrl: string | null;
}

/** Anchor a "YYYY-MM-DD" calendar date at UTC midnight (for whole-day diffs). */
function ymdToMs(ymd: string): number {
  const [year, month, day] = ymd.split("-");

  return Date.UTC(Number(year), Number(month) - 1, Number(day));
}

/**
 * The calendar day ("YYYY-MM-DD") that `value` represents in `timeZone`. A Date
 * (an instant) is resolved to its wall-clock day in the zone; a string is
 * already a tz-less calendar date and is taken as-is.
 */
function toCalendarYmd(value: string | Date, timeZone: string): string {
  return value instanceof Date
    ? toYmdInTimezone(value, timeZone)
    : value.slice(0, 10);
}

/**
 * The 0-based day of the rotation that `today` falls on, in `timeZone`.
 *
 * `dayIndex = floor((today - startDate) in whole calendar days) mod durationDays`.
 * Both dates are resolved to calendar days in `timeZone` first, so the same
 * instant can land on different cycle days for clients in different zones.
 * Before the start date the cycle has not begun: `started` false, `dayIndex`
 * null. Defaults to "UTC".
 */
export function currentCycleDayIndex(
  startDate: string | Date,
  durationDays: number,
  today: string | Date,
  timeZone = "UTC"
): CycleDayPosition {
  const span =
    Number.isInteger(durationDays) && durationDays > 0 ? durationDays : 1;
  const diffDays = Math.floor(
    (ymdToMs(toCalendarYmd(today, timeZone)) -
      ymdToMs(toCalendarYmd(startDate, timeZone))) /
      MS_PER_DAY
  );

  if (diffDays < 0) {
    return { started: false, dayIndex: null };
  }

  return { started: true, dayIndex: ((diffDays % span) + span) % span };
}

/**
 * Bucket slots into one entry per rotation day (0..durationDays-1), preserving
 * the incoming order. Slots whose `day_index` is out of range are dropped.
 */
export function groupSlotsByDay(
  durationDays: number,
  slots: MealSlotWithOptions[]
): CycleDay[] {
  const span =
    Number.isInteger(durationDays) && durationDays > 0 ? durationDays : 0;
  const days: CycleDay[] = Array.from({ length: span }, (_, dayIndex) => ({
    dayIndex,
    slots: [],
  }));

  for (const slot of slots) {
    const day = days[slot.day_index];

    if (day !== undefined) {
      day.slots.push(slot);
    }
  }

  return days;
}

/**
 * Project a fetched cycle tree (or `null` for no active cycle) into the
 * client-facing view: the cycle header, today's ISO date, where today falls in
 * the rotation, and the slots grouped by day. Pure — safe to unit-test and to
 * call from the route after the DB read.
 */
export function buildClientCycleView(
  tree: MealCycleTree | null,
  today: string | Date,
  timeZone = "UTC",
  selections: ClientSelection[] = [],
  logs: MealLogRow[] = []
): ClientCycleView {
  const todayIso = toCalendarYmd(today, timeZone);
  const selectionMap: Record<string, string> = {};

  for (const selection of selections) {
    selectionMap[selection.slot_id] = selection.option_id;
  }

  const logMap: Record<string, ClientMealLog> = {};

  for (const log of logs) {
    logMap[log.slot_id] = {
      status: log.status,
      optionId: log.option_id,
      comment: log.comment,
      photoUrl: log.photo_url,
    };
  }

  if (tree === null) {
    return {
      cycle: null,
      today: todayIso,
      position: null,
      days: [],
      selections: selectionMap,
      logs: logMap,
      notes: [],
    };
  }

  return {
    cycle: {
      id: tree.id,
      name: tree.name,
      durationDays: tree.duration_days,
      startDate: tree.start_date,
      status: tree.status,
    },
    today: todayIso,
    position: currentCycleDayIndex(
      tree.start_date,
      tree.duration_days,
      today,
      timeZone
    ),
    days: groupSlotsByDay(tree.duration_days, tree.slots),
    selections: selectionMap,
    logs: logMap,
    notes: [],
  };
}
