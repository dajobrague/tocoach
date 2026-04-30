/**
 * Autosave hook for the trainer template editor surface.
 *
 * Pattern:
 *   - The surface holds a local `editingDoc` state (the current ChartsDocument
 *     including in-progress edits).
 *   - useAutosave watches editingDoc + the latest known ETag (`lastEtag`)
 *     and fires a debounced PUT after 600ms of inactivity.
 *   - On a clean save, lastEtag updates from the response.
 *   - On 409 (etagConflict), we surface a flag; the surface refetches
 *     and the caller decides whether to retry.
 *
 * Reorder/add/delete are NOT debounced — call `flushNow()` to force an
 * immediate save and bypass the timer.
 */

"use client";

import type { ChartsDocument } from "@/lib/charts/types";
import type { ChartSaveState } from "@/lib/charts/types";

import { useEffect, useRef, useState } from "react";

import {
  useUpdateChartTemplate,
  type UpdateTemplateBody,
} from "@/lib/charts/hooks";

interface Args {
  doc: ChartsDocument;
  /** Current ETag; updates after each successful save. */
  etag: string;
  /** Updated when the doc/etag flips on a conflict so caller can refetch. */
  onConflict: (currentEtag: string) => void;
  /** Called on each successful save with the new ETag. */
  onSaved: (newEtag: string) => void;
  /** Optional auto-apply flag; passed through if defined. */
  autoApplyToNewClients?: boolean;
  /** Set to true to suppress autosave (e.g. during initial fetch). */
  paused?: boolean;
  debounceMs?: number;
}

export function useAutosave({
  doc,
  etag,
  onConflict,
  onSaved,
  autoApplyToNewClients,
  paused,
  debounceMs = 600,
}: Args): {
  state: ChartSaveState;
  lastError: Error | null;
  flushNow: () => Promise<void>;
} {
  const [state, setState] = useState<ChartSaveState>("idle");
  const [lastError, setLastError] = useState<Error | null>(null);
  const mut = useUpdateChartTemplate();
  // Latest doc + etag, updated synchronously so flushNow always sees fresh.
  const docRef = useRef(doc);
  const etagRef = useRef(etag);
  // The "last persisted" doc — compared shallowly to avoid no-op saves.
  const persistedRef = useRef<ChartsDocument>(doc);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Mirror props into refs.
  useEffect(() => {
    docRef.current = doc;
  }, [doc]);
  useEffect(() => {
    etagRef.current = etag;
    // After a fresh load, sync the persisted ref so we don't immediately
    // try to save the just-loaded doc back.
    persistedRef.current = doc;
  }, [etag]);

  const performSave = async (): Promise<void> => {
    if (paused) return;
    const current = docRef.current;
    // Cheap shallow signature: charts.length + JSON of charts. Avoids saving
    // back the same doc when only refs flip.
    const sig = JSON.stringify(current);

    if (sig === JSON.stringify(persistedRef.current)) return;
    setState("saving");
    setLastError(null);
    try {
      const body: UpdateTemplateBody & { ifMatch?: string } = {
        charts: current,
        ...(autoApplyToNewClients !== undefined
          ? { auto_apply_to_new_clients: autoApplyToNewClients }
          : {}),
        ifMatch: etagRef.current,
      };
      const res = await mut.mutateAsync(body);

      if (res.etagConflict) {
        setState("error");
        setLastError(new Error("etag_conflict"));
        onConflict(res.etagConflict.current_updated_at);

        return;
      }
      persistedRef.current = res.data.charts;
      etagRef.current = res.data.updated_at;
      onSaved(res.data.updated_at);
      setState("saved");
    } catch (err) {
      setState("error");
      setLastError(err instanceof Error ? err : new Error(String(err)));
    }
  };

  // Schedule a debounced save when doc changes.
  useEffect(() => {
    if (paused) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void performSave();
    }, debounceMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [doc, paused]);

  const flushNow = async (): Promise<void> => {
    if (timerRef.current) clearTimeout(timerRef.current);
    await performSave();
  };

  return { state, lastError, flushNow };
}
