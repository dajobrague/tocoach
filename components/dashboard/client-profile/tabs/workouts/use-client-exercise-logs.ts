"use client";

import type { ExerciseGroup, ExerciseLog } from "../progress/types";

import { useCallback, useEffect, useMemo, useState } from "react";

import { groupLogsByExercise } from "../progress/helpers";

interface State {
  logs: ExerciseLog[];
  loading: boolean;
  error: string | null;
}

export interface UseClientExerciseLogs {
  loading: boolean;
  error: string | null;
  /**
   * Returns logs whose `exercise_id` matches. Empty array if no logs for that exercise.
   */
  getLogsForExercise: (exerciseId: string) => ExerciseLog[];
  /**
   * Returns the logs that belong to a specific planned slot
   * (`session_exercises.id`), so a card shows only THIS slot's history:
   *  - logs whose `session_exercise_id === sessionExerciseId` (new/backfilled),
   *    plus
   *  - legacy logs with no `session_exercise_id` whose `exercise_id` matches
   *    (fallback for old data that predates per-slot attribution).
   */
  getLogsForSlot: (
    sessionExerciseId: string | null,
    exerciseId: string
  ) => ExerciseLog[];
  /**
   * Groups logs that aren't part of the current plan (i.e. their exercise_id
   * isn't in the prescribed set). Returns groups sorted by exercise name.
   */
  getOrphanGroups: (prescribedExerciseIds: Set<string>) => ExerciseGroup[];
  refetch: () => void;
}

/**
 * Fetches all exercise logs for a client (no date range) once per mount, memoizes
 * the indexed views, and exposes selectors. Designed to live at the tab level so
 * every exercise card shares the same fetched dataset.
 */
export function useClientExerciseLogs(clientId: string): UseClientExerciseLogs {
  const [{ logs, loading, error }, setState] = useState<State>({
    logs: [],
    loading: true,
    error: null,
  });

  const fetchAll = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      // No startDate/endDate => endpoint returns all-time logs for the client.
      const res = await fetch(`/api/clients/${clientId}/exercise-logs/trainer`);
      const json = await res.json();

      if (!json.success) {
        setState({
          logs: [],
          loading: false,
          error: "No se pudieron cargar los registros.",
        });

        return;
      }
      setState({
        logs: json.exerciseLogs ?? [],
        loading: false,
        error: null,
      });
    } catch {
      setState({ logs: [], loading: false, error: "Error de conexión." });
    }
  }, [clientId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const byExercise = useMemo(() => {
    const map = new Map<string, ExerciseLog[]>();

    for (const log of logs) {
      if (!log.exercise_id) continue;
      const arr = map.get(log.exercise_id) ?? [];

      arr.push(log);
      map.set(log.exercise_id, arr);
    }

    return map;
  }, [logs]);

  const getLogsForExercise = useCallback(
    (exerciseId: string) => byExercise.get(exerciseId) ?? [],
    [byExercise]
  );

  // Mirror of `byExercise` keyed by slot for O(1) per-slot lookup. Only logs
  // that carry a non-empty `session_exercise_id` land here; legacy logs fall
  // back through `byExercise` below.
  const bySlot = useMemo(() => {
    const map = new Map<string, ExerciseLog[]>();

    for (const log of logs) {
      const slotId = log.session_exercise_id;

      if (typeof slotId !== "string" || slotId.length === 0) continue;
      const arr = map.get(slotId) ?? [];

      arr.push(log);
      map.set(slotId, arr);
    }

    return map;
  }, [logs]);

  const getLogsForSlot = useCallback(
    (sessionExerciseId: string | null, exerciseId: string) => {
      const slotMatches =
        typeof sessionExerciseId === "string" && sessionExerciseId.length > 0
          ? (bySlot.get(sessionExerciseId) ?? [])
          : [];

      // Legacy logs: no slot recorded, attributed by library exercise_id.
      const legacyMatches = (byExercise.get(exerciseId) ?? []).filter((log) => {
        const slotId = log.session_exercise_id;

        return typeof slotId !== "string" || slotId.length === 0;
      });

      return [...slotMatches, ...legacyMatches];
    },
    [bySlot, byExercise]
  );

  const getOrphanGroups = useCallback(
    (prescribedExerciseIds: Set<string>) => {
      const orphanLogs = logs.filter(
        (l) => l.exercise_id && !prescribedExerciseIds.has(l.exercise_id)
      );

      return groupLogsByExercise(orphanLogs);
    },
    [logs]
  );

  return {
    loading,
    error,
    getLogsForExercise,
    getLogsForSlot,
    getOrphanGroups,
    refetch: fetchAll,
  };
}
