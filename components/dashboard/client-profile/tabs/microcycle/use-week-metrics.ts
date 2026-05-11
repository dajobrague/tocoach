"use client";

import type { ExerciseLog } from "../progress/types";
import type {
  DayMetrics,
  PrescribedExercise,
  ScheduledSessionRow,
  WeekMetrics,
} from "./types";

import { useCallback, useEffect, useState } from "react";

import { classifyDay, computeDayAdherence } from "./adherence";

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

export function useWeekMetrics(
  clientId: string,
  weekStart: Date
): UseWeekMetrics {
  const [data, setData] = useState<WeekMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const weekStartYmd = getLocalYmd(weekStart);
  const weekEndYmd = getLocalYmd(addDays(weekStart, 6));

  const fetchWeek = useCallback(
    async (signal: AbortSignal) => {
      setLoading(true);
      setError(null);

      try {
        const [schedRes, logsRes] = await Promise.all([
          fetch(
            `/api/clients/${clientId}/scheduled-sessions/trainer?startDate=${weekStartYmd}&endDate=${weekEndYmd}`,
            { signal }
          ),
          fetch(
            `/api/clients/${clientId}/exercise-logs/trainer?startDate=${weekStartYmd}&endDate=${weekEndYmd}`,
            { signal }
          ),
        ]);

        const [schedJson, logsJson] = await Promise.all([
          schedRes.json(),
          logsRes.json(),
        ]);

        if (!schedJson.success || !logsJson.success) {
          setError("No se pudieron cargar las métricas.");
          setLoading(false);

          return;
        }

        const scheduled: ScheduledSessionRow[] =
          schedJson.scheduledSessions ?? [];
        const logs: ExerciseLog[] = logsJson.exerciseLogs ?? [];

        // Index scheduled rows by date for O(1) per-day lookup.
        const scheduledByDate = new Map<string, ScheduledSessionRow>();

        for (const row of scheduled) {
          scheduledByDate.set(row.scheduled_date, row);
        }

        // Index logs by date too. Logs that map to a scheduled date contribute
        // to adherence; logs whose date has no scheduled session become orphans.
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
          const prescribed = scheduledSession
            ? toPrescribed(scheduledSession)
            : [];
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

        // Orphans: logs on a date that has no scheduled session.
        const orphansByDate = new Map<string, ExerciseLog[]>();

        for (const [date, dayLogs] of logsByDate.entries()) {
          if (!scheduledByDate.has(date)) {
            orphansByDate.set(date, dayLogs);
          }
        }

        if (!signal.aborted) {
          setData({ days, orphansByDate });
          setLoading(false);
        }
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setError("Error de conexión.");
        setLoading(false);
      }
    },
    [clientId, weekStartYmd, weekEndYmd]
  );

  const refetch = useCallback(() => {
    const controller = new AbortController();

    fetchWeek(controller.signal);
  }, [fetchWeek]);

  useEffect(() => {
    const controller = new AbortController();

    fetchWeek(controller.signal);

    return () => controller.abort();
  }, [fetchWeek]);

  return { data, loading, error, refetch };
}
