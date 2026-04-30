/**
 * Autosave hook — endpoint-agnostic.
 *
 * Pattern:
 *   - The surface holds a local `editingDoc` state (the current ChartsDocument
 *     including in-progress edits).
 *   - useAutosave watches editingDoc + the latest known ETag (`lastEtag`)
 *     and fires a debounced save after 600ms of inactivity.
 *   - On a clean save, lastEtag updates from the response.
 *   - On 409 (etagConflict), we surface a flag; the surface refetches
 *     and the caller decides whether to retry.
 *
 * Reorder/add/delete are NOT debounced — call `flushNow()` to force an
 * immediate save and bypass the timer.
 *
 * The caller passes a `save` function rather than the hook constructing
 * its own mutation, so the same logic works for the trainer template
 * (PUT /api/charts/template) and the per-client editor
 * (PUT /api/charts/clients/[clientId]).
 */

"use client";

import type { ChartsDocument, ChartSaveState } from "@/lib/charts/types";

import { useEffect, useRef, useState } from "react";

export interface AutosaveSaveResult {
  /** When set, the save 409'd; the new ETag from the server. */
  etagConflict?: { current_updated_at: string };
  /** When the save succeeded, the persisted shape + new ETag. */
  data?: { charts: ChartsDocument; updated_at: string };
}

export type AutosaveSaveFn = (vars: {
  charts: ChartsDocument;
  ifMatch?: string;
  auto_apply_to_new_clients?: boolean;
}) => Promise<AutosaveSaveResult>;

interface Args {
  doc: ChartsDocument;
  /** Current ETag; updates after each successful save. */
  etag: string;
  /** Updated when the doc/etag flips on a conflict so caller can refetch. */
  onConflict: (currentEtag: string) => void;
  /** Called on each successful save with the new ETag. */
  onSaved: (newEtag: string) => void;
  /** Saver — provided by the caller (template or per-client). */
  save: AutosaveSaveFn;
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
  save,
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
  // Latest doc + etag, updated synchronously so flushNow always sees fresh.
  const docRef = useRef(doc);
  const etagRef = useRef(etag);
  const saveRef = useRef(save);
  // The "last persisted" doc — compared shallowly to avoid no-op saves.
  const persistedRef = useRef<ChartsDocument>(doc);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Mirror props into refs.
  useEffect(() => {
    docRef.current = doc;
  }, [doc]);
  useEffect(() => {
    saveRef.current = save;
  }, [save]);
  useEffect(() => {
    etagRef.current = etag;
    // After a fresh load, sync the persisted ref so we don't immediately
    // try to save the just-loaded doc back.
    persistedRef.current = doc;
  }, [etag]);

  const performSave = async (): Promise<void> => {
    if (paused) return;
    const current = docRef.current;
    const sig = JSON.stringify(current);

    if (sig === JSON.stringify(persistedRef.current)) return;
    setState("saving");
    setLastError(null);
    try {
      const res = await saveRef.current({
        charts: current,
        ...(autoApplyToNewClients !== undefined
          ? { auto_apply_to_new_clients: autoApplyToNewClients }
          : {}),
        ifMatch: etagRef.current,
      });

      if (res.etagConflict) {
        setState("error");
        setLastError(new Error("etag_conflict"));
        onConflict(res.etagConflict.current_updated_at);

        return;
      }
      if (!res.data) {
        setState("error");
        setLastError(new Error("save returned no data"));

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
