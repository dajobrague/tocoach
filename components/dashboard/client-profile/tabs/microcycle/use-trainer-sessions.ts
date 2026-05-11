"use client";

import { useCallback, useEffect, useState } from "react";

interface TrainerSession {
  id: string;
  name: string;
}

const cacheByClient = new Map<string, TrainerSession[]>();

/**
 * Loads the unique session list across all the client's active programs.
 * Used by the day-editor session picker. Module-level cache shared across
 * editor opens within a single page session.
 */
export function useTrainerSessions(clientId: string): {
  sessions: TrainerSession[];
  loading: boolean;
  error: string | null;
} {
  const cached = cacheByClient.get(clientId) ?? null;
  const [sessions, setSessions] = useState<TrainerSession[]>(cached ?? []);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    if (cacheByClient.has(clientId)) {
      setSessions(cacheByClient.get(clientId) ?? []);
      setLoading(false);

      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/programs`);
      const json = await res.json();

      if (!json.success) {
        setError("No se pudieron cargar las sesiones disponibles.");
        setLoading(false);

        return;
      }

      const out: TrainerSession[] = [];
      const seen = new Set<string>();

      for (const program of json.programs ?? []) {
        for (const sess of program.sessions ?? []) {
          if (!sess.id || seen.has(sess.id)) continue;
          seen.add(sess.id);
          out.push({ id: sess.id, name: sess.name });
        }
      }

      cacheByClient.set(clientId, out);
      setSessions(out);
      setLoading(false);
    } catch {
      setError("Error de conexión.");
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return { sessions, loading, error };
}
