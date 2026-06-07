"use client";

import type { ExerciseLog } from "../progress/types";
import type {
  DayMetrics,
  PrescribedExercise,
  ScheduledSessionRow,
  SessionEntry,
  WeekMetrics,
} from "./types";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  classifyDay,
  computeAdherenceFromLogs,
  computeDayAdherence,
} from "./adherence";

import { getLocalYmd } from "@/lib/forms/client-helpers";

interface UseWeekMetrics {
  data: WeekMetrics | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);

  d.setDate(d.getDate() + n);

  return d;
}

function toPrescribed(row: ScheduledSessionRow): PrescribedExercise[] {
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
    }));
}

function buildWeekMetrics(
  weekStart: Date,
  scheduled: ScheduledSessionRow[],
  logs: ExerciseLog[]
): WeekMetrics {
  // Index scheduled rows por fecha (cada fecha tiene N filas, una por
  // sesión tocada o template virtual).
  const scheduledByDate = new Map<string, ScheduledSessionRow[]>();

  for (const row of scheduled) {
    const arr = scheduledByDate.get(row.scheduled_date) ?? [];

    arr.push(row);
    scheduledByDate.set(row.scheduled_date, arr);
  }

  const logsByDateSession = new Map<string, ExerciseLog[]>();

  for (const log of logs) {
    const trainingDate =
      (log as unknown as { training_date?: string }).training_date ??
      log.scheduled_date;
    const key = `${trainingDate}|${log.session_id ?? ""}`;
    const arr = logsByDateSession.get(key) ?? [];

    arr.push(log);
    logsByDateSession.set(key, arr);
  }

  const todayYmd = getLocalYmd(new Date());
  const days: DayMetrics[] = [];

  for (let i = 0; i < 7; i++) {
    const date = addDays(weekStart, i);
    const ymd = getLocalYmd(date);
    const rows = scheduledByDate.get(ymd) ?? [];
    const isFuture = ymd > todayYmd;

    // recommendedSessionName: la fila de template (los IDs virtuales
    // del template arrancan con "template:"). Si no hay nada, null = rest.
    const templateVirtualRow =
      rows.find((r) => r.id.startsWith("template:")) ?? null;
    const recommendedSessionName = templateVirtualRow?.session?.name ?? null;

    // Build session entries from scheduled rows, matching logs.
    const claimedLogKeys = new Set<string>();
    const sessions: SessionEntry[] = rows.map((row) => {
      const sessionId = row.session?.id ?? "";
      const logKey = `${ymd}|${sessionId}`;
      const sessionLogs = logsByDateSession.get(logKey) ?? [];

      if (sessionLogs.length > 0) claimedLogKeys.add(logKey);

      const prescribed = toPrescribed(row);
      // If the client logged exercises that don't match the prescription,
      // compute adherence from what they actually did instead of showing 0%.
      const prescriptionMatch = prescribed.some((p) =>
        sessionLogs.some((l) => l.exercise_id === p.exerciseId)
      );
      const adherence =
        sessionLogs.length > 0 && !prescriptionMatch
          ? computeAdherenceFromLogs(sessionLogs)
          : computeDayAdherence(prescribed, sessionLogs);
      const classification = classifyDay(
        prescribed.length > 0 || sessionLogs.length > 0,
        adherence,
        isFuture
      );

      return {
        scheduledSession: row,
        prescribed,
        logs: sessionLogs,
        adherence,
        classification,
      };
    });

    // Promote unclaimed logs into real session entries. These are logs
    // completed on this day whose session_id doesn't match any scheduled
    // row — the client trained a different session than prescribed.
    for (const [logKey, keyLogs] of logsByDateSession) {
      const [dateStr] = logKey.split("|");

      if (dateStr !== ymd || claimedLogKeys.has(logKey)) continue;

      const adherence = computeAdherenceFromLogs(keyLogs);
      const sessionId = keyLogs[0]?.session_id ?? null;

      // Look up the real session name from any scheduled row that
      // references this session_id (could be on a different date).
      const knownRow = sessionId
        ? scheduled.find((r) => r.session?.id === sessionId)
        : null;
      const resolvedName = knownRow?.session?.name ?? "Sesión registrada";

      sessions.push({
        scheduledSession: {
          id: `logged:${ymd}:${sessionId ?? "unknown"}`,
          scheduled_date: ymd,
          status: "completed",
          completion_date: keyLogs[0]?.completed_at ?? null,
          session: sessionId
            ? {
                id: sessionId,
                name: resolvedName,
                session_exercises: knownRow?.session?.session_exercises ?? [],
              }
            : null,
        },
        prescribed: [],
        logs: keyLogs,
        adherence,
        classification: classifyDay(true, adherence, isFuture),
      });
    }

    // If the day has any session with actual work, hide sessions with
    // zero logs — those are usually the client selecting the wrong
    // session in the picker. The trainer only needs to see what was done.
    const anyHasLogs = sessions.some((s) => s.logs.length > 0);
    const visibleSessions =
      anyHasLogs && !isFuture
        ? sessions.filter((s) => s.logs.length > 0)
        : sessions;

    days.push({
      date: ymd,
      sessions: visibleSessions,
      recommendedSessionName,
      isToday: ymd === todayYmd,
      isFuture,
    });
  }

  const orphansByDate = new Map<string, ExerciseLog[]>();

  return { days, orphansByDate };
}

// Bounded LRU on top of Map insertion order. Browsing many weeks during a
// single trainer session used to grow this cache unboundedly (each entry
// holds the week's logs + prescription tree).
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
  // Outstanding prefetch controllers — keyed por weekStart YMD. Cuando
  // el usuario navega rápido, abortamos prefetches viejos para no
  // saturar la red.
  const prefetchControllersRef = useRef<Map<string, AbortController>>(
    new Map()
  );
  const [data, setData] = useState<WeekMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Reset cache when the client changes — a new client has a different
  // microcycle and different logs.
  useEffect(() => {
    cacheRef.current = new Map();
    // Aborta prefetches del cliente anterior.
    for (const c of prefetchControllersRef.current.values()) c.abort();
    prefetchControllersRef.current.clear();
    setData(null);
  }, [clientId]);

  // Abort prefetches al desmontar (evita fetches huérfanos cuando el
  // trainer cambia de cliente o cierra la pestaña).
  useEffect(() => {
    const controllers = prefetchControllersRef.current;

    return () => {
      for (const c of controllers.values()) c.abort();
      controllers.clear();
    };
  }, []);

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
  // warm the cache so the next user click is instant. Cada prefetch
  // registra su AbortController para que reset/unmount lo pueda cortar.
  const prefetch = useCallback(
    (start: Date) => {
      const startYmd = getLocalYmd(start);

      if (cacheRef.current.has(startYmd)) return;
      // Si ya hay un prefetch en vuelo para esa semana, no dispares otro.
      if (prefetchControllersRef.current.has(startYmd)) return;
      const controller = new AbortController();

      prefetchControllersRef.current.set(startYmd, controller);
      fetchAndCache(start, controller.signal)
        .catch(() => {
          /* best-effort prefetch */
        })
        .finally(() => {
          // Limpia el registro cuando el prefetch termina (resuelto o
          // abortado) para no acumular controllers ya consumidos.
          if (prefetchControllersRef.current.get(startYmd) === controller) {
            prefetchControllersRef.current.delete(startYmd);
          }
        });
    },
    [fetchAndCache]
  );

  useEffect(() => {
    const startYmd = getLocalYmd(weekStart);
    const cached = cacheRef.current.get(startYmd);

    if (cached) {
      // LRU promote-on-read: re-set el entry para moverlo al final del
      // insertion order, evitando que la semana más recientemente vista
      // sea evictada antes que una vieja nunca consultada.
      setLru(cacheRef.current, startYmd, cached);
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

  return { data, loading, error, refetch };
}
