"use client";

import type { ExerciseLog } from "../progress/types";
import type {
  DayMetrics,
  PrescribedExercise,
  ScheduledSessionRow,
  WeekMetrics,
} from "./types";

import { useCallback, useEffect, useRef, useState } from "react";

import { classifyDay, computeDayAdherence } from "./adherence";

import { getLocalYmd } from "@/lib/forms/client-helpers";

interface UseWeekMetrics {
  data: WeekMetrics | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
  /** Drop a cached week (or all if omitted) and refetch the current week. */
  invalidate: (weekStartYmd?: string) => void;
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);

  d.setDate(d.getDate() + n);

  return d;
}

function toPrescribed(row: ScheduledSessionRow): PrescribedExercise[] {
  // Override wins when present.
  if (row.override_exercises && row.override_exercises.length > 0) {
    return [...row.override_exercises]
      .sort((a, b) => a.exercise_order - b.exercise_order)
      .map((oe) => {
        const perSet = (oe.prescribed_sets ?? [])
          .slice()
          .sort((a, b) => a.set_number - b.set_number)
          .map((s) => ({
            setNumber: s.set_number,
            reps: s.reps,
            weightKg: s.weight_kg,
          }));

        return {
          exerciseId: oe.exercise.id,
          name: oe.exercise.name,
          category: oe.exercise.category,
          // When perSet is present, prescribedSets reflects the count.
          prescribedSets: perSet.length > 0 ? perSet.length : (oe.sets ?? 0),
          prescribedReps: oe.reps,
          prescribedWeightKg: oe.weight_kg,
          perSet,
        };
      });
  }

  if (!row.session) return [];

  return [...row.session.session_exercises]
    .sort((a, b) => a.exercise_order - b.exercise_order)
    .map((se) => ({
      exerciseId: se.exercise.id,
      name: se.exercise.name,
      category: se.exercise.category,
      prescribedSets: se.sets ?? 0,
      prescribedReps: se.reps,
      prescribedWeightKg: se.weight_kg,
      perSet: [],
    }));
}

function buildWeekMetrics(
  weekStart: Date,
  scheduled: ScheduledSessionRow[],
  logs: ExerciseLog[]
): WeekMetrics {
  const scheduledByDate = new Map<string, ScheduledSessionRow>();

  for (const row of scheduled) scheduledByDate.set(row.scheduled_date, row);

  const logsByDate = new Map<string, ExerciseLog[]>();

  for (const log of logs) {
    const arr = logsByDate.get(log.scheduled_date) ?? [];

    arr.push(log);
    logsByDate.set(log.scheduled_date, arr);
  }

  const todayYmd = getLocalYmd(new Date());
  const days: DayMetrics[] = [];

  for (let i = 0; i < 7; i++) {
    const date = addDays(weekStart, i);
    const ymd = getLocalYmd(date);
    const scheduledSession = scheduledByDate.get(ymd) ?? null;
    const prescribed = scheduledSession ? toPrescribed(scheduledSession) : [];
    const dayLogs = logsByDate.get(ymd) ?? [];
    const adherence = computeDayAdherence(prescribed, dayLogs);
    const isFuture = ymd > todayYmd;
    const classification = classifyDay(
      prescribed.length > 0,
      adherence,
      isFuture
    );

    days.push({
      date: ymd,
      scheduledSession,
      prescribed,
      logs: dayLogs,
      adherence,
      classification,
      isToday: ymd === todayYmd,
      isFuture,
    });
  }

  const orphansByDate = new Map<string, ExerciseLog[]>();

  for (const [date, dayLogs] of logsByDate.entries()) {
    const sched = scheduledByDate.get(date);

    if (!sched) {
      // No scheduled session at all → every log on this date is off-plan.
      orphansByDate.set(date, dayLogs);
      continue;
    }

    // Scheduled session exists. Logs whose exercise_id is NOT in the day's
    // prescribed list are still off-plan ("did something extra"). Previously
    // these were silently dropped, so the trainer couldn't see them.
    const prescribed = toPrescribed(sched);
    const prescribedIds = new Set(prescribed.map((p) => p.exerciseId));
    const offPlan = dayLogs.filter(
      (l) => l.exercise_id != null && !prescribedIds.has(l.exercise_id)
    );

    if (offPlan.length > 0) orphansByDate.set(date, offPlan);
  }

  return { days, orphansByDate };
}

// Bounded LRU on top of Map insertion order. Browsing many weeks during a
// single trainer session used to grow this cache unboundedly (each entry
// holds the week's logs + override rows + prescription tree).
const MAX_CACHED_WEEKS = 12;

function setLru(
  cache: Map<string, WeekMetrics>,
  key: string,
  value: WeekMetrics
): void {
  if (cache.has(key)) cache.delete(key);
  cache.set(key, value);
  while (cache.size > MAX_CACHED_WEEKS) {
    const oldest = cache.keys().next().value;

    if (oldest == null) break;
    cache.delete(oldest);
  }
}

/**
 * Fetches scheduled-sessions + exercise-logs for a week, indexes them, and
 * memoizes the result in an in-memory cache keyed by Monday Y-M-D.
 *
 * Performance pattern:
 * - Cache hit → instant data, no spinner. A background refresh still kicks
 *   off so the cache stays fresh.
 * - Cache miss → spinner until fetch resolves.
 * - On every successful fetch we prefetch the previous and next week in the
 *   background, so the most likely click (prev / next) lands on cache.
 *
 * Cache is reset whenever clientId changes.
 */
export function useWeekMetrics(
  clientId: string,
  weekStart: Date
): UseWeekMetrics {
  const cacheRef = useRef<Map<string, WeekMetrics>>(new Map());
  const [data, setData] = useState<WeekMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Reset cache when the client changes — a new client has a different
  // microcycle and different logs.
  useEffect(() => {
    cacheRef.current = new Map();
    setData(null);
  }, [clientId]);

  const fetchAndCache = useCallback(
    async (start: Date, signal?: AbortSignal): Promise<WeekMetrics | null> => {
      const startYmd = getLocalYmd(start);
      const endYmd = getLocalYmd(addDays(start, 6));

      try {
        const init = signal ? { signal } : {};
        // allSettled so one endpoint 5xx-ing doesn't black-hole the whole
        // week: if scheduled-sessions resolves but exercise-logs fails we
        // can still render the prescription side with empty adherence.
        const [schedSettled, logsSettled] = await Promise.allSettled([
          fetch(
            `/api/clients/${clientId}/scheduled-sessions/trainer?startDate=${startYmd}&endDate=${endYmd}`,
            init
          ),
          fetch(
            `/api/clients/${clientId}/exercise-logs/trainer?startDate=${startYmd}&endDate=${endYmd}`,
            init
          ),
        ]);

        const schedJson =
          schedSettled.status === "fulfilled"
            ? await schedSettled.value.json().catch(() => null)
            : null;
        const logsJson =
          logsSettled.status === "fulfilled"
            ? await logsSettled.value.json().catch(() => null)
            : null;

        // Both failed → genuine failure, surface to caller as null.
        if (!schedJson?.success && !logsJson?.success) return null;

        const weekMetrics = buildWeekMetrics(
          start,
          schedJson?.success ? (schedJson.scheduledSessions ?? []) : [],
          logsJson?.success ? (logsJson.exerciseLogs ?? []) : []
        );

        setLru(cacheRef.current, startYmd, weekMetrics);

        return weekMetrics;
      } catch (e) {
        if ((e as Error).name === "AbortError") return null;
        throw e;
      }
    },
    [clientId]
  );

  // Background prefetch — fire-and-forget. No state updates here; we just
  // warm the cache so the next user click is instant.
  const prefetch = useCallback(
    (start: Date) => {
      const startYmd = getLocalYmd(start);

      if (cacheRef.current.has(startYmd)) return;
      fetchAndCache(start).catch(() => {
        /* best-effort prefetch */
      });
    },
    [fetchAndCache]
  );

  useEffect(() => {
    const startYmd = getLocalYmd(weekStart);
    const cached = cacheRef.current.get(startYmd);

    if (cached) {
      setData(cached);
      setLoading(false);
      setError(null);
    } else {
      setLoading(true);
    }

    const controller = new AbortController();

    fetchAndCache(weekStart, controller.signal)
      .then((wm) => {
        if (controller.signal.aborted) return;

        if (wm) {
          setData(wm);
          setError(null);
        } else if (!cached) {
          setError("No se pudieron cargar las métricas.");
        }
        setLoading(false);

        // Warm neighbors in the background so prev/next clicks are instant.
        prefetch(addDays(weekStart, -7));
        prefetch(addDays(weekStart, 7));
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        if (!cached) setError("Error de conexión.");
        setLoading(false);
      });

    return () => controller.abort();
  }, [weekStart, fetchAndCache, prefetch]);

  const refetch = useCallback(() => {
    const startYmd = getLocalYmd(weekStart);

    cacheRef.current.delete(startYmd);
    fetchAndCache(weekStart)
      .then((wm) => {
        if (wm) {
          setData(wm);
          setError(null);
        } else {
          setError("No se pudieron cargar las métricas.");
        }
      })
      .catch(() => setError("Error de conexión."));
  }, [weekStart, fetchAndCache]);

  const invalidate = useCallback(
    (weekStartYmdToFlush?: string) => {
      if (weekStartYmdToFlush) {
        cacheRef.current.delete(weekStartYmdToFlush);
      } else {
        cacheRef.current.clear();
      }
      refetch();
    },
    [refetch]
  );

  return { data, loading, error, refetch, invalidate };
}
