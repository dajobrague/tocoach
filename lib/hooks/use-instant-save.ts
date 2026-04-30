"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type InstantSaveStatus = "idle" | "saving" | "saved" | "error";

export interface UseInstantSaveResult {
  /** Current save state, suitable for driving a "Guardado ✓" indicator. */
  status: InstantSaveStatus;
  /** Error message from the most recent failed save, if any. */
  error: string | null;
  /**
   * Trigger a save. Calls made while another save is pending cancel the
   * previous request and reset the debounce timer — the latest value wins.
   *
   * `opts.immediate` bypasses the debounce (useful for boolean toggles where
   * instant feedback matters more than debouncing).
   */
  save: (value: unknown, opts?: { immediate?: boolean }) => void;
}

/**
 * Generic "auto-save on change" helper. Debounces calls and guarantees the
 * latest value wins over any in-flight request.
 *
 * Usage:
 * ```tsx
 * const { status, save } = useInstantSave(async (value) => {
 *   await fetch("/api/foo", { method: "PUT", body: JSON.stringify(value), signal });
 * });
 * // onChange: save(nextValue);
 * ```
 *
 * The `mutationFn` receives an `AbortSignal` so network calls can be
 * cancelled when a newer save supersedes them. Implementations that don't
 * support cancellation can simply ignore it.
 */
export function useInstantSave(
  mutationFn: (value: unknown, signal: AbortSignal) => Promise<void>,
  debounceMs: number = 800
): UseInstantSaveResult {
  const [status, setStatus] = useState<InstantSaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  // Track a monotonically increasing call id so we can ignore results from
  // stale requests that resolve after a newer save has started.
  const callSeqRef = useRef(0);
  // Keep mutationFn in a ref so we don't need to re-wire timers on re-renders.
  const mutationFnRef = useRef(mutationFn);

  useEffect(() => {
    mutationFnRef.current = mutationFn;
  }, [mutationFn]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;

      if (timerRef.current) clearTimeout(timerRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  const runSave = useCallback(async (value: unknown) => {
    // Cancel any in-flight request.
    if (abortRef.current) {
      abortRef.current.abort();
    }

    const controller = new AbortController();

    abortRef.current = controller;
    callSeqRef.current += 1;

    const mySeq = callSeqRef.current;

    setStatus("saving");
    setError(null);

    try {
      await mutationFnRef.current(value, controller.signal);

      if (!mountedRef.current) return;
      // Only the most recent call gets to flip the UI into "saved".
      if (mySeq !== callSeqRef.current) return;

      setStatus("saved");

      // Auto-revert to idle after a short delay for the "Guardado ✓" badge.
      setTimeout(() => {
        if (!mountedRef.current) return;
        if (mySeq !== callSeqRef.current) return;
        setStatus("idle");
      }, 1500);
    } catch (err: unknown) {
      if (!mountedRef.current) return;
      // Ignore abort errors — they mean the call was intentionally superseded.
      if (controller.signal.aborted) return;
      if (mySeq !== callSeqRef.current) return;

      const message =
        err instanceof Error
          ? err.message
          : "No se pudo guardar. Reintenta por favor.";

      setStatus("error");
      setError(message);
    }
  }, []);

  const save = useCallback(
    (value: unknown, opts?: { immediate?: boolean }) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }

      if (opts?.immediate) {
        void runSave(value);

        return;
      }

      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        void runSave(value);
      }, debounceMs);
    },
    [debounceMs, runSave]
  );

  // Identity-stable result object.
  //
  // Returning a fresh `{ status, error, save }` literal on each render forced
  // any consumer that put the result into a `useCallback`/`useMemo`/`useEffect`
  // dependency array to recompute every render — and when a downstream
  // component fed that recomputed callback into one of its own effects (see
  // `CheckInScheduleEditor`'s `onScheduleChange`), the effect re-fired every
  // render, looping `save()` indefinitely. The visible symptom was a save
  // status badge that cycled "Guardando / Error al guardar" every couple of
  // seconds with no user input.
  //
  // We expose `status` and `error` as getters on a single object held in a
  // ref. The object reference never changes; reads of `.status`/`.error`
  // always return the latest React state. React still re-renders on state
  // change (because the underlying useState updates), so consumers of
  // `<InstantSaveBadge status={save.status} />` still see UI updates.
  const statusRef = useRef(status);
  const errorRef = useRef(error);
  const saveRef = useRef(save);

  statusRef.current = status;
  errorRef.current = error;
  saveRef.current = save;

  const stableResultRef = useRef<UseInstantSaveResult | null>(null);

  if (!stableResultRef.current) {
    stableResultRef.current = {
      get status() {
        return statusRef.current;
      },
      get error() {
        return errorRef.current;
      },
      save: (value, opts) => saveRef.current(value, opts),
    };
  }

  return stableResultRef.current;
}
