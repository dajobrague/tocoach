import type {
  CycleStatus,
  MealCycleTree,
  MealSlotWithOptions,
} from "./meal-cycle-service";

/**
 * Pure cycle-day math + projection for the client's "today" view (P4).
 *
 * Everything here is deterministic and timezone-safe: dates are compared by
 * calendar day in UTC, never by wall-clock, so a client and the server agree on
 * "which day of the rotation is today" regardless of local time. No DB access —
 * the route hands these helpers the already-fetched (snapshot-backed) tree.
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
}

/** Calendar-day count (UTC) for a DATE string ("YYYY-MM-DD") or a Date. */
function toUtcMidnightMs(value: string | Date): number {
  if (value instanceof Date) {
    return Date.UTC(
      value.getUTCFullYear(),
      value.getUTCMonth(),
      value.getUTCDate()
    );
  }

  const [year, month, day] = value.slice(0, 10).split("-");

  return Date.UTC(Number(year), Number(month) - 1, Number(day));
}

function toIsoDate(value: string | Date): string {
  return value instanceof Date
    ? value.toISOString().slice(0, 10)
    : value.slice(0, 10);
}

/**
 * The 0-based day of the rotation that `today` falls on.
 *
 * `dayIndex = floor((today - startDate) in whole days) mod durationDays`. Before
 * the start date the cycle has not begun, so `started` is false and `dayIndex`
 * is null. Comparison is by calendar day in UTC, so time-of-day and timezone
 * never shift the result.
 */
export function currentCycleDayIndex(
  startDate: string | Date,
  durationDays: number,
  today: string | Date
): CycleDayPosition {
  const span =
    Number.isInteger(durationDays) && durationDays > 0 ? durationDays : 1;
  const diffDays = Math.floor(
    (toUtcMidnightMs(today) - toUtcMidnightMs(startDate)) / MS_PER_DAY
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
  today: string | Date
): ClientCycleView {
  const todayIso = toIsoDate(today);

  if (tree === null) {
    return { cycle: null, today: todayIso, position: null, days: [] };
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
      todayIso
    ),
    days: groupSlotsByDay(tree.duration_days, tree.slots),
  };
}
