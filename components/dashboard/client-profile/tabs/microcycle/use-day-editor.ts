"use client";

import type { PrescribedExercise } from "./types";

import { useCallback, useMemo, useState } from "react";

export interface EditorRow {
  /** Stable React key — preserved across reorders. */
  key: string;
  exerciseId: string;
  name: string;
  category: string;
  sets: number | null;
  reps: string | null;
  weightKg: number | null;
}

interface UseDayEditor {
  rows: EditorRow[];
  sessionId: string | null;
  hasChanges: boolean;
  isValid: boolean;
  saving: boolean;
  resetting: boolean;
  error: string | null;
  setSessionId: (id: string | null) => void;
  updateRow: (key: string, patch: Partial<EditorRow>) => void;
  reorderRows: (next: EditorRow[]) => void;
  addRow: (input: {
    exerciseId: string;
    name: string;
    category: string;
  }) => void;
  removeRow: (key: string) => void;
  /** Replace the whole list — used when the trainer swaps session. */
  replaceFromPrescribed: (
    prescribed: PrescribedExercise[],
    sessionId: string | null
  ) => void;
  save: () => Promise<{ ok: boolean; locked?: boolean }>;
  reset: () => Promise<{ ok: boolean; locked?: boolean }>;
}

function rowKey(): string {
  return `r-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function fromPrescribed(p: PrescribedExercise): EditorRow {
  return {
    key: rowKey(),
    exerciseId: p.exerciseId,
    name: p.name,
    category: p.category,
    sets: p.prescribedSets > 0 ? p.prescribedSets : null,
    reps: p.prescribedReps,
    weightKg: p.prescribedWeightKg,
  };
}

interface UseDayEditorParams {
  clientId: string;
  scheduledDate: string;
  initialPrescribed: PrescribedExercise[];
  initialSessionId: string | null;
  /** Called after a successful save or reset. Editor closes & metrics refresh. */
  onSaved: () => void;
}

export function useDayEditor({
  clientId,
  scheduledDate,
  initialPrescribed,
  initialSessionId,
  onSaved,
}: UseDayEditorParams): UseDayEditor {
  const initialRows = useMemo(
    () => initialPrescribed.map(fromPrescribed),
    [initialPrescribed]
  );
  const [rows, setRows] = useState<EditorRow[]>(initialRows);
  const [sessionId, setSessionId] = useState<string | null>(initialSessionId);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateRow = useCallback((key: string, patch: Partial<EditorRow>) => {
    setRows((prev) =>
      prev.map((r) => (r.key === key ? { ...r, ...patch } : r))
    );
  }, []);

  const reorderRows = useCallback((next: EditorRow[]) => {
    setRows(next);
  }, []);

  const addRow = useCallback(
    (input: { exerciseId: string; name: string; category: string }) => {
      setRows((prev) => [
        ...prev,
        {
          key: rowKey(),
          exerciseId: input.exerciseId,
          name: input.name,
          category: input.category,
          sets: null,
          reps: null,
          weightKg: null,
        },
      ]);
    },
    []
  );

  const removeRow = useCallback((key: string) => {
    setRows((prev) => prev.filter((r) => r.key !== key));
  }, []);

  const replaceFromPrescribed = useCallback(
    (prescribed: PrescribedExercise[], nextSessionId: string | null) => {
      setRows(prescribed.map(fromPrescribed));
      setSessionId(nextSessionId);
    },
    []
  );

  const isValid = useMemo(() => {
    for (const r of rows) {
      if (r.sets != null && r.sets <= 0) return false;
      if (r.sets != null && r.sets > 0 && (!r.reps || r.reps.trim() === ""))
        return false;
      if (r.weightKg != null && r.weightKg < 0) return false;
    }

    return true;
  }, [rows]);

  const hasChanges = useMemo(() => {
    if (sessionId !== initialSessionId) return true;
    if (rows.length !== initialRows.length) return true;

    for (let i = 0; i < rows.length; i++) {
      const a = rows[i]!;
      const b = initialRows[i]!;

      if (
        a.exerciseId !== b.exerciseId ||
        a.sets !== b.sets ||
        a.reps !== b.reps ||
        a.weightKg !== b.weightKg
      ) {
        return true;
      }
    }

    return false;
  }, [rows, sessionId, initialRows, initialSessionId]);

  const save = useCallback(async (): Promise<{
    ok: boolean;
    locked?: boolean;
  }> => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/clients/${clientId}/scheduled-sessions/trainer/day`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scheduledDate,
            sessionId,
            exercises: rows.map((r, idx) => ({
              exerciseId: r.exerciseId,
              exerciseOrder: idx + 1,
              sets: r.sets,
              reps: r.reps,
              weightKg: r.weightKg,
            })),
          }),
        }
      );

      if (res.status === 409) {
        setError("Día con registros — no se puede editar.");
        setSaving(false);

        return { ok: false, locked: true };
      }

      const json = await res.json();

      if (!json.success) {
        setError(json.error ?? "Error al guardar.");
        setSaving(false);

        return { ok: false };
      }

      setSaving(false);
      onSaved();

      return { ok: true };
    } catch {
      setError("Error de conexión.");
      setSaving(false);

      return { ok: false };
    }
  }, [clientId, scheduledDate, sessionId, rows, onSaved]);

  const reset = useCallback(async (): Promise<{
    ok: boolean;
    locked?: boolean;
  }> => {
    setResetting(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/clients/${clientId}/scheduled-sessions/trainer/day?date=${scheduledDate}`,
        { method: "DELETE" }
      );

      if (res.status === 409) {
        setError("Día con registros — no se puede resetear.");
        setResetting(false);

        return { ok: false, locked: true };
      }

      const json = await res.json();

      if (!json.success) {
        setError(json.error ?? "Error al resetear.");
        setResetting(false);

        return { ok: false };
      }

      setResetting(false);
      onSaved();

      return { ok: true };
    } catch {
      setError("Error de conexión.");
      setResetting(false);

      return { ok: false };
    }
  }, [clientId, scheduledDate, onSaved]);

  return {
    rows,
    sessionId,
    hasChanges,
    isValid,
    saving,
    resetting,
    error,
    setSessionId,
    updateRow,
    reorderRows,
    addRow,
    removeRow,
    replaceFromPrescribed,
    save,
    reset,
  };
}
