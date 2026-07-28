"use client";

// Datos de la vista de MES de Seguimiento (rediseño, rebanada 1).
// Misma pareja de endpoints que la semana, pero sobre el rango completo de
// la grilla del mes (semanas enteras, lunes a domingo), y la MISMA derivación
// (buildDayMetricsRange) para que un día se clasifique igual se mire donde
// se mire. Cache LRU chico por mes; se resetea al cambiar de cliente.

import type { ExerciseLog } from "../progress/types";
import type { DayMetrics, ScheduledSessionRow } from "./types";

import { useCallback, useEffect, useRef, useState } from "react";

import { buildDayMetricsRange } from "./use-week-metrics";

import { buildMonthGrid } from "@/features/trainer/cycles/calendar-helpers";

interface UseMonthMetrics {
  /** DayMetrics indexados por fecha, cubriendo la grilla entera del mes. */
  byDate: Map<string, DayMetrics> | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

const MAX_CACHED_MONTHS = 4;

function setLru(
  cache: Map<string, Map<string, DayMetrics>>,
  key: string,
  value: Map<string, DayMetrics>
): void {
  if (cache.has(key)) cache.delete(key);
  cache.set(key, value);
  while (cache.size > MAX_CACHED_MONTHS) {
    const oldest = cache.keys().next().value;

    if (oldest == null) break;
    cache.delete(oldest);
  }
}

/** Rango [primer día, cantidad de días] de la grilla del mes de `monthYmd`. */
function gridRange(monthYmd: string): { startYmd: string; count: number } {
  const grid = buildMonthGrid(monthYmd);
  const first = grid[0]?.[0]?.date ?? monthYmd;
  const count = grid.length * 7;

  return { startYmd: first, count };
}

export function useMonthMetrics(
  clientId: string,
  monthYmd: string
): UseMonthMetrics {
  const cacheRef = useRef<Map<string, Map<string, DayMetrics>>>(new Map());
  const [byDate, setByDate] = useState<Map<string, DayMetrics> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    cacheRef.current = new Map();
    setByDate(null);
  }, [clientId]);

  const fetchMonth = useCallback(
    async (signal?: AbortSignal): Promise<Map<string, DayMetrics> | null> => {
      const { startYmd, count } = gridRange(monthYmd);
      const endYmd = ((): string => {
        const d = new Date(`${startYmd}T00:00:00`);

        d.setDate(d.getDate() + count - 1);
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");

        return `${d.getFullYear()}-${mm}-${dd}`;
      })();

      const init = signal ? { signal } : {};
      // allSettled: si un endpoint falla igual pintamos la mitad que llegó
      // (misma tolerancia parcial que la semana).
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

      if (!schedJson?.success && !logsJson?.success) {
        return null;
      }

      const scheduled: ScheduledSessionRow[] = schedJson?.success
        ? (schedJson.scheduledSessions ?? schedJson.data ?? [])
        : [];
      const logs: ExerciseLog[] = logsJson?.success
        ? (logsJson.exerciseLogs ?? logsJson.data ?? [])
        : [];

      const days = buildDayMetricsRange(
        new Date(`${startYmd}T00:00:00`),
        count,
        scheduled,
        logs
      );

      return new Map(days.map((day) => [day.date, day]));
    },
    [clientId, monthYmd]
  );

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const cached = cacheRef.current.get(monthYmd);

    if (cached) {
      // Hit → render instantáneo + refresh silencioso de fondo.
      setByDate(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }
    setError(null);

    fetchMonth(controller.signal)
      .then((result) => {
        if (cancelled) return;
        if (result === null) {
          if (!cached) {
            setError("No se pudieron cargar los datos del mes");
          }

          return;
        }
        setLru(cacheRef.current, monthYmd, result);
        setByDate(result);
      })
      .catch((err: unknown) => {
        if (
          cancelled ||
          (err instanceof DOMException && err.name === "AbortError")
        )
          return;
        if (!cached) setError("No se pudieron cargar los datos del mes");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [fetchMonth, monthYmd]);

  const refetch = useCallback(() => {
    cacheRef.current.delete(monthYmd);
    setByDate((current) => current); // trigger via effect below
    // Re-ejecuta el effect de arriba forzando un nuevo fetch: al borrar el
    // cache alcanza con volver a llamar fetchMonth directamente.
    void fetchMonth().then((result) => {
      if (result !== null) {
        setLru(cacheRef.current, monthYmd, result);
        setByDate(result);
        setError(null);
      } else {
        setError("No se pudieron cargar los datos del mes");
      }
    });
  }, [fetchMonth, monthYmd]);

  return { byDate, loading, error, refetch };
}
