"use client";

import type { PrescribedExercise } from "./types";

import { useCallback, useMemo, useState } from "react";

/** A single prescribed set in per-set mode. */
export interface EditorSetRow {
  /** Stable React key — preserved across reorders/edits. */
  key: string;
  setNumber: number;
  reps: string | null;
  weightKg: number | null;
}

export interface EditorRow {
  /** Stable React key — preserved across reorders. */
  key: string;
  exerciseId: string;
  name: string;
  category: string;
  /** Editor mode: uniform sends sets/reps/weight; perSet sends setsDetail. */
  mode: "uniform" | "perSet";
  /** Uniform fields. */
  sets: number | null;
  reps: string | null;
  weightKg: number | null;
  /** Per-set rows (only relevant when mode === "perSet"). */
  setsDetail: EditorSetRow[];
  /**
   * Stash of `setsDetail` captured the last time the row was in perSet mode.
   * Lets switchToUniform → switchToPerSet round-trip restore the user's
   * per-set work instead of silently re-seeding from the uniform values.
   */
  cachedSetsDetail?: EditorSetRow[];
}

interface UseDayEditor {
  rows: EditorRow[];
  sessionId: string | null;
  hasChanges: boolean;
  isValid: boolean;
  saving: boolean;
  resetting: boolean;
  error: string | null;
  /** Permite al consumidor surface errores externos (e.g. al swappear sesión). */
  setError: (message: string | null) => void;
  setSessionId: (id: string | null) => void;
  updateRow: (key: string, patch: Partial<EditorRow>) => void;
  reorderRows: (next: EditorRow[]) => void;
  addRow: (input: {
    exerciseId: string;
    name: string;
    category: string;
  }) => void;
  removeRow: (key: string) => void;
  /** Switch a row from uniform → per-set; pre-fills N rows with uniform values. */
  switchToPerSet: (key: string) => void;
  /** Switch a row from per-set → uniform; takes set 1's values as the uniform defaults. */
  switchToUniform: (key: string) => void;
  /** Update a per-set row's reps/weight. */
  updateSetDetail: (
    rowKey: string,
    setKey: string,
    patch: Partial<EditorSetRow>
  ) => void;
  addSetDetail: (rowKey: string) => void;
  removeSetDetail: (rowKey: string, setKey: string) => void;
  /** Replace the whole list — used when the trainer swaps session. */
  replaceFromPrescribed: (
    prescribed: PrescribedExercise[],
    sessionId: string | null
  ) => void;
  save: () => Promise<{ ok: boolean; locked?: boolean }>;
  reset: () => Promise<{ ok: boolean; locked?: boolean }>;
}

function shortKey(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function fromPrescribed(p: PrescribedExercise): EditorRow {
  // When the prescription carries per-set values, hydrate in perSet mode.
  if (p.perSet && p.perSet.length > 0) {
    return {
      key: shortKey("r"),
      exerciseId: p.exerciseId,
      name: p.name,
      category: p.category,
      mode: "perSet",
      sets: p.perSet.length,
      reps: null,
      weightKg: null,
      setsDetail: p.perSet.map((s) => ({
        key: shortKey("s"),
        setNumber: s.setNumber,
        reps: s.reps,
        weightKg: s.weightKg,
      })),
    };
  }

  return {
    key: shortKey("r"),
    exerciseId: p.exerciseId,
    name: p.name,
    category: p.category,
    mode: "uniform",
    sets: p.prescribedSets > 0 ? p.prescribedSets : null,
    reps: p.prescribedReps,
    weightKg: p.prescribedWeightKg,
    setsDetail: [],
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
          key: shortKey("r"),
          exerciseId: input.exerciseId,
          name: input.name,
          category: input.category,
          mode: "uniform",
          sets: null,
          reps: null,
          weightKg: null,
          setsDetail: [],
        },
      ]);
    },
    []
  );

  const removeRow = useCallback((key: string) => {
    setRows((prev) => prev.filter((r) => r.key !== key));
  }, []);

  const switchToPerSet = useCallback((key: string) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.key !== key) return r;
        // Round-trip: when the row was previously in perSet mode and the
        // user only flipped to uniform briefly, restore the cached detail
        // instead of re-seeding from uniform values (which would silently
        // erase per-set RPE/weight progressions the trainer just typed).
        if (r.cachedSetsDetail && r.cachedSetsDetail.length > 0) {
          const { cachedSetsDetail: _drop, ...rest } = r;

          return {
            ...rest,
            mode: "perSet",
            sets: r.cachedSetsDetail.length,
            setsDetail: r.cachedSetsDetail,
          };
        }
        // First-time switch: build N sets from current uniform values.
        const count = r.sets && r.sets > 0 ? r.sets : 1;
        const detail: EditorSetRow[] = Array.from(
          { length: count },
          (_, i) => ({
            key: shortKey("s"),
            setNumber: i + 1,
            reps: r.reps,
            weightKg: r.weightKg,
          })
        );

        return {
          ...r,
          mode: "perSet",
          sets: count,
          setsDetail: detail,
        };
      })
    );
  }, []);

  const switchToUniform = useCallback((key: string) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.key !== key) return r;
        const first = r.setsDetail[0];
        // Stash so the user can flip back without losing progressions. Only
        // include `cachedSetsDetail` in the new object when we actually have
        // something to cache — exactOptionalPropertyTypes forbids assigning
        // `undefined` to an optional property.
        const cached =
          r.setsDetail.length > 0 ? r.setsDetail : r.cachedSetsDetail;

        return {
          ...r,
          mode: "uniform",
          sets: r.setsDetail.length || r.sets,
          reps: first?.reps ?? r.reps,
          weightKg: first?.weightKg ?? r.weightKg,
          ...(cached ? { cachedSetsDetail: cached } : {}),
          setsDetail: [],
        };
      })
    );
  }, []);

  const updateSetDetail = useCallback(
    (rowKey: string, setKey: string, patch: Partial<EditorSetRow>) => {
      setRows((prev) =>
        prev.map((r) => {
          if (r.key !== rowKey) return r;

          return {
            ...r,
            setsDetail: r.setsDetail.map((s) =>
              s.key === setKey ? { ...s, ...patch } : s
            ),
          };
        })
      );
    },
    []
  );

  const addSetDetail = useCallback((rowKey: string) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.key !== rowKey) return r;
        const nextNumber = (r.setsDetail.at(-1)?.setNumber ?? 0) + 1;

        return {
          ...r,
          sets: r.setsDetail.length + 1,
          setsDetail: [
            ...r.setsDetail,
            {
              key: shortKey("s"),
              setNumber: nextNumber,
              reps: null,
              weightKg: null,
            },
          ],
        };
      })
    );
  }, []);

  const removeSetDetail = useCallback((rowKey: string, setKey: string) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.key !== rowKey) return r;
        const next = r.setsDetail.filter((s) => s.key !== setKey);
        // Renumber so set_number stays contiguous starting at 1.
        const renumbered = next.map((s, i) => ({ ...s, setNumber: i + 1 }));

        return {
          ...r,
          sets: renumbered.length,
          setsDetail: renumbered,
        };
      })
    );
  }, []);

  const replaceFromPrescribed = useCallback(
    (prescribed: PrescribedExercise[], nextSessionId: string | null) => {
      setRows(prescribed.map(fromPrescribed));
      setSessionId(nextSessionId);
      // Limpia errores stale: un error previo ("Día con registros") no
      // aplica más cuando swappeás a otra sesión.
      setError(null);
    },
    []
  );

  const isValid = useMemo(() => {
    for (const r of rows) {
      if (r.mode === "uniform") {
        if (r.sets != null && r.sets <= 0) return false;
        if (r.sets != null && r.sets > 0 && (!r.reps || r.reps.trim() === ""))
          return false;
        if (r.weightKg != null && r.weightKg < 0) return false;
      } else {
        if (r.setsDetail.length === 0) return false;
        for (const s of r.setsDetail) {
          if (!s.reps || s.reps.trim() === "") return false;
          if (s.weightKg != null && s.weightKg < 0) return false;
        }
      }
    }

    return true;
  }, [rows]);

  const hasChanges = useMemo(() => {
    if (sessionId !== initialSessionId) return true;
    if (rows.length !== initialRows.length) return true;

    for (let i = 0; i < rows.length; i++) {
      const a = rows[i]!;
      const b = initialRows[i]!;

      if (a.exerciseId !== b.exerciseId) return true;
      if (a.mode !== b.mode) return true;

      if (a.mode === "uniform") {
        if (a.sets !== b.sets || a.reps !== b.reps || a.weightKg !== b.weightKg)
          return true;
        // El usuario puede haber flipeado perSet→edits→uniform: en uniform
        // los valores principales coinciden con el initial pero cached
        // tiene trabajo per-set que se perdería en silencio. Si los
        // valores cacheados difieren de las uniform actuales, marcamos
        // como cambiado para habilitar Guardar (uniform se persiste, y
        // el usuario puede decidir flipear de vuelta antes).
        if (a.cachedSetsDetail) {
          for (const s of a.cachedSetsDetail) {
            if (s.reps !== a.reps || s.weightKg !== a.weightKg) return true;
          }
        }
      } else {
        if (a.setsDetail.length !== b.setsDetail.length) return true;
        for (let j = 0; j < a.setsDetail.length; j++) {
          const sa = a.setsDetail[j]!;
          const sb = b.setsDetail[j]!;

          if (
            sa.setNumber !== sb.setNumber ||
            sa.reps !== sb.reps ||
            sa.weightKg !== sb.weightKg
          ) {
            return true;
          }
        }
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
            exercises: rows.map((r, idx) => {
              if (r.mode === "perSet") {
                return {
                  exerciseId: r.exerciseId,
                  exerciseOrder: idx + 1,
                  sets: r.setsDetail.length,
                  reps: null,
                  weightKg: null,
                  setsDetail: r.setsDetail.map((s) => ({
                    setNumber: s.setNumber,
                    reps: s.reps,
                    weightKg: s.weightKg,
                  })),
                };
              }

              return {
                exerciseId: r.exerciseId,
                exerciseOrder: idx + 1,
                sets: r.sets,
                reps: r.reps,
                weightKg: r.weightKg,
              };
            }),
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
    setError,
    setSessionId,
    updateRow,
    reorderRows,
    addRow,
    removeRow,
    switchToPerSet,
    switchToUniform,
    updateSetDetail,
    addSetDetail,
    removeSetDetail,
    replaceFromPrescribed,
    save,
    reset,
  };
}
