import type {
  ClientCycleView,
  ClientDayNote,
  ClientMealLog,
} from "./cycle-day";
import type { MealCycleTree, MealSlotWithOptions } from "./meal-cycle-service";
import type { ClientSelection } from "./option-selection";
import type { OverrideRow } from "./override-types";
import type { MealLogRow } from "@/lib/nutrition/logs/meal-log-service";

import { buildClientCycleView } from "./cycle-day";
import { applyOverridesToClientView } from "./override-client-view";

import { isWithinLogWindow } from "@/lib/nutrition/logs/log-window";

const MS_PER_DAY = 86_400_000;
const DAYS_IN_WEEK = 7;

/** One resolved day of the client's week. */
export interface ClientWeekDay {
  /** "YYYY-MM-DD". */
  date: string;
  /** False before the cycle starts (a clean not-started shape). */
  started: boolean;
  /** Rotation day index, or `null` before the cycle starts. */
  dayIndex: number | null;
  /** The day's slots with swaps applied (frozen snapshot as the option). */
  slots: MealSlotWithOptions[];
  /** Trainer notes that apply to this date. */
  notes: ClientDayNote[];
  /** This date's logs (slotId → log). */
  logs: Record<string, ClientMealLog>;
  /** Whether the client may log on this date (started, today-or-past, ≤30d). */
  canLog: boolean;
}

/** A week of the client's plan, resolved per date. */
export interface ClientWeek {
  weekStart: string;
  cycle: ClientCycleView["cycle"];
  days: ClientWeekDay[];
  /** The client's standing per-slot choice (slotId → optionId), week-global. */
  selections: Record<string, string>;
}

/**
 * Build the 7-day client week from `weekStart` (Monday), resolving each date
 * independently: rotation day → overrides applied (swaps replace options from
 * the frozen snapshot, notes attach) → that date's logs → `canLog`. Reuses the
 * single-date {@link buildClientCycleView} + {@link applyOverridesToClientView}
 * fold per date, so the week and the today view never disagree. Pure: no DB.
 */
export function buildClientWeek(
  tree: MealCycleTree | null,
  overrides: OverrideRow[],
  logs: MealLogRow[],
  weekStart: string,
  todayYmd: string,
  timeZone = "UTC",
  selections: ClientSelection[] = []
): ClientWeek {
  const header = buildClientCycleView(tree, weekStart, timeZone, selections);
  const days: ClientWeekDay[] = [];

  for (let offset = 0; offset < DAYS_IN_WEEK; offset++) {
    const date = addDays(weekStart, offset);
    const dayLogs = logs.filter((log) => log.log_date === date);
    const view = applyOverridesToClientView(
      buildClientCycleView(tree, date, timeZone, selections, dayLogs),
      tree,
      overrides,
      date,
      timeZone
    );

    days.push(resolveDay(view, date, todayYmd));
  }

  return {
    weekStart,
    cycle: header.cycle,
    days,
    selections: header.selections,
  };
}

/** Project a single-date resolved view into a week day. */
function resolveDay(
  view: ClientCycleView,
  date: string,
  todayYmd: string
): ClientWeekDay {
  const started =
    view.position?.started === true && view.position.dayIndex !== null;

  if (started === false || view.position === null) {
    return {
      date,
      started: false,
      dayIndex: null,
      slots: [],
      notes: [],
      logs: {},
      canLog: false,
    };
  }

  const dayIndex = view.position.dayIndex!;

  return {
    date,
    started: true,
    dayIndex,
    slots: view.days[dayIndex]?.slots ?? [],
    notes: view.notes,
    logs: view.logs,
    canLog: isWithinLogWindow(date, todayYmd),
  };
}

function addDays(ymd: string, days: number): string {
  return new Date(ymdToMs(ymd) + days * MS_PER_DAY).toISOString().slice(0, 10);
}

function ymdToMs(ymd: string): number {
  const [year, month, day] = ymd.split("-");

  return Date.UTC(Number(year), Number(month) - 1, Number(day));
}
