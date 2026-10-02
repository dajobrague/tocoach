// Temporizador de descanso entre series. Solo cliente: no toca el log.
//
// Guarda un instante de fin absoluto (Date.now() + ms) en vez de restar
// ticks: si la pestaña pasa a segundo plano los intervalos se ralentizan,
// pero al volver el tiempo restante sale bien de la resta.

import { useCallback, useEffect, useState } from "react";

const TICK_MS = 250;
const FINISHED_MS = 2500;

/** Milisegundos que faltan hasta `endAt` (nunca negativo). */
export function remainingMs(endAt: number, now: number): number {
  return Math.max(0, endAt - now);
}

/** "1:30", "0:05" — redondeando hacia arriba para no mostrar 0:00 antes de tiempo. */
export function formatCountdown(ms: number): string {
  const total = Math.ceil(Math.max(0, ms) / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export interface RestTimer {
  isRunning: boolean;
  /** Breve estado tras llegar a 0 ("¡A por la siguiente!"). */
  isFinished: boolean;
  remainingMs: number;
  start: (seconds: number) => void;
  addSeconds: (seconds: number) => void;
  stop: () => void;
}

export function useRestTimer(): RestTimer {
  const [endAt, setEndAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [isFinished, setIsFinished] = useState(false);

  const start = useCallback((seconds: number) => {
    const t = Date.now();

    setNow(t);
    setEndAt(t + seconds * 1000);
    setIsFinished(false);
  }, []);

  const addSeconds = useCallback((seconds: number) => {
    setEndAt((e) => (e === null ? null : e + seconds * 1000));
  }, []);

  const stop = useCallback(() => {
    setEndAt(null);
    setIsFinished(false);
  }, []);

  useEffect(() => {
    if (endAt === null) return;
    const id = window.setInterval(() => {
      const t = Date.now();

      setNow(t);
      if (t < endAt) return;
      setEndAt(null);
      setIsFinished(true);
      if (typeof navigator.vibrate === "function") {
        navigator.vibrate([200, 100, 200]);
      }
    }, TICK_MS);

    return () => window.clearInterval(id);
  }, [endAt]);

  useEffect(() => {
    if (!isFinished) return;
    const id = window.setTimeout(() => setIsFinished(false), FINISHED_MS);

    return () => window.clearTimeout(id);
  }, [isFinished]);

  return {
    isRunning: endAt !== null,
    isFinished,
    remainingMs: endAt === null ? 0 : remainingMs(endAt, now),
    start,
    addSeconds,
    stop,
  };
}
