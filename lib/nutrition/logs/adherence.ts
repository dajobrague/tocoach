import type { MealLogStatus } from "./meal-log-service";

import { currentCycleDayIndex } from "@/lib/nutrition/cycles/cycle-day";

/**
 * Pure adherence aggregation (P5-T4).
 *
 * Given the client's planned meals per day (slot count from the cycle) and their
 * logs over a date range, computes logged-vs-planned per day and per 7-day week,
 * a % compliance (capped at 100), and a status breakdown. No DB access, no date
 * library — weeks are bucketed by position in the contiguous day list, so it is
 * timezone-agnostic and fully deterministic.
 *
 * Compliance counts a meal as "logged" regardless of status (engagement), so a
 * skipped meal still counts toward compliance; the statusBreakdown separately
 * shows what was logged.
 */

const DAYS_PER_WEEK = 7;

/** One planned day: the number of meal slots scheduled that date. */
export interface AdherenceInputDay {
  date: string;
  planned: number;
}

/** One meal log within the range. */
export interface AdherenceLog {
  logDate: string;
  status: MealLogStatus;
}

/**
 * Two honest rates per bucket (both capped at 100):
 *   - engagementPct: meals LOGGED (any status) ÷ planned — did they check in?
 *   - adherencePct:  eaten_planned ONLY ÷ planned — did they eat on plan?
 * A client who skips every meal is 100% engagement but 0% adherence.
 */
export interface AdherenceDay {
  date: string;
  planned: number;
  logged: number;
  engagementPct: number;
  adherencePct: number;
}

export interface AdherenceWeek {
  weekStart: string;
  weekEnd: string;
  planned: number;
  logged: number;
  engagementPct: number;
  adherencePct: number;
}

export interface AdherenceReport {
  from: string;
  to: string;
  totals: {
    planned: number;
    logged: number;
    engagementPct: number;
    adherencePct: number;
  };
  statusBreakdown: Record<MealLogStatus, number>;
  days: AdherenceDay[];
  weeks: AdherenceWeek[];
}

const MS_PER_DAY = 86_400_000;

/** The active cycle's shape needed to plan a date range. */
export interface PlannedCycle {
  startDate: string;
  durationDays: number;
  /** Slot count per rotation day index (plannedByDayIndex[dayIndex]). */
  plannedByDayIndex: number[];
}

function ymdToMs(ymd: string): number {
  const [year, month, day] = ymd.slice(0, 10).split("-");

  return Date.UTC(Number(year), Number(month) - 1, Number(day));
}

function isoDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * The planned meal count for every calendar day in `[from, to]` (inclusive),
 * derived from the client's active cycle: each date maps to its rotation day
 * (UTC calendar days) and that day's slot count. Dates before the cycle start —
 * or any date when there is no active cycle — are planned 0.
 */
export function buildPlannedDays(
  from: string,
  to: string,
  cycle: PlannedCycle | null
): AdherenceInputDay[] {
  const fromMs = ymdToMs(from);
  const toMs = ymdToMs(to);
  const out: AdherenceInputDay[] = [];

  for (let ms = fromMs; ms <= toMs; ms += MS_PER_DAY) {
    const date = isoDay(ms);

    if (cycle === null) {
      out.push({ date, planned: 0 });
      continue;
    }

    const position = currentCycleDayIndex(
      cycle.startDate,
      cycle.durationDays,
      date
    );

    const planned =
      position.started && position.dayIndex !== null
        ? (cycle.plannedByDayIndex[position.dayIndex] ?? 0)
        : 0;

    out.push({ date, planned });
  }

  return out;
}

/** counted toward plan (capped) / planned, rounded; 0 when nothing is planned. */
function pct(counted: number, planned: number): number {
  if (planned <= 0) {
    return 0;
  }

  return Math.round((Math.min(counted, planned) / planned) * 100);
}

/** Per-day tallies kept internally for week/total aggregation. */
interface DayTally {
  date: string;
  planned: number;
  logged: number;
  eatenPlanned: number;
}

export function computeAdherence(
  days: AdherenceInputDay[],
  logs: AdherenceLog[]
): AdherenceReport {
  const loggedByDate = new Map<string, number>();
  const eatenPlannedByDate = new Map<string, number>();
  const statusBreakdown: Record<MealLogStatus, number> = {
    eaten_planned: 0,
    eaten_other: 0,
    skipped: 0,
  };

  for (const log of logs) {
    loggedByDate.set(log.logDate, (loggedByDate.get(log.logDate) ?? 0) + 1);
    statusBreakdown[log.status] += 1;

    if (log.status === "eaten_planned") {
      eatenPlannedByDate.set(
        log.logDate,
        (eatenPlannedByDate.get(log.logDate) ?? 0) + 1
      );
    }
  }

  const tallies: DayTally[] = days.map((day) => ({
    date: day.date,
    planned: day.planned,
    logged: loggedByDate.get(day.date) ?? 0,
    eatenPlanned: eatenPlannedByDate.get(day.date) ?? 0,
  }));

  const dayRows: AdherenceDay[] = tallies.map((t) => ({
    date: t.date,
    planned: t.planned,
    logged: t.logged,
    engagementPct: pct(t.logged, t.planned),
    adherencePct: pct(t.eatenPlanned, t.planned),
  }));

  const weeks: AdherenceWeek[] = [];

  for (let i = 0; i < tallies.length; i += DAYS_PER_WEEK) {
    const bucket = tallies.slice(i, i + DAYS_PER_WEEK);
    const planned = bucket.reduce((sum, t) => sum + t.planned, 0);
    const logged = bucket.reduce((sum, t) => sum + t.logged, 0);
    const loggedEff = bucket.reduce(
      (sum, t) => sum + Math.min(t.logged, t.planned),
      0
    );
    const eatenEff = bucket.reduce(
      (sum, t) => sum + Math.min(t.eatenPlanned, t.planned),
      0
    );

    weeks.push({
      weekStart: bucket[0]!.date,
      weekEnd: bucket[bucket.length - 1]!.date,
      planned,
      logged,
      engagementPct: pct(loggedEff, planned),
      adherencePct: pct(eatenEff, planned),
    });
  }

  const totalPlanned = tallies.reduce((sum, t) => sum + t.planned, 0);
  const totalLogged = tallies.reduce((sum, t) => sum + t.logged, 0);
  const totalLoggedEff = tallies.reduce(
    (sum, t) => sum + Math.min(t.logged, t.planned),
    0
  );
  const totalEatenEff = tallies.reduce(
    (sum, t) => sum + Math.min(t.eatenPlanned, t.planned),
    0
  );

  return {
    from: tallies[0]?.date ?? "",
    to: tallies[tallies.length - 1]?.date ?? "",
    totals: {
      planned: totalPlanned,
      logged: totalLogged,
      engagementPct: pct(totalLoggedEff, totalPlanned),
      adherencePct: pct(totalEatenEff, totalPlanned),
    },
    statusBreakdown,
    days: dayRows,
    weeks,
  };
}
