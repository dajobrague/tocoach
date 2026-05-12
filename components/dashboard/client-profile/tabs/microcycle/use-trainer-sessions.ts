"use client";

import { useCallback, useEffect, useState } from "react";

interface TrainerSession {
  id: string;
  name: string;
}

interface CacheEntry {
  data: TrainerSession[];
  fetchedAt: number;
}

const cacheByClient = new Map<string, CacheEntry>();

// TTL del cache del session picker. Antes era infinito → sesiones
// creadas en la sub-tab Configuración no aparecían hasta refresh hard.
// 5 minutos balancea responsiveness vs network. Cross-tab invalidation
// queda como follow-up (usar invalidateTrainerSessions desde el flujo
// de mutación).
const CACHE_TTL_MS = 5 * 60 * 1000;

function getFresh(clientId: string): TrainerSession[] | null {
  const entry = cacheByClient.get(clientId);

  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) {
    cacheByClient.delete(clientId);

    return null;
  }

  return entry.data;
}

/**
 * Invalida manualmente el cache para forzar refetch al próximo mount.
 * Llamar desde el flujo de creación/edición/eliminación de sesiones del
 * trainer (configuración tab) para que el picker vea cambios al instante.
 */
export function invalidateTrainerSessions(clientId?: string): void {
  if (clientId) {
    cacheByClient.delete(clientId);
  } else {
    cacheByClient.clear();
  }
}

/**
 * Loads the unique session list across all the client's active programs.
 * Used by the day-editor session picker. Module-level cache shared across
 * editor opens within a single page session, con TTL de 5min.
 */
export function useTrainerSessions(clientId: string): {
  sessions: TrainerSession[];
  loading: boolean;
  error: string | null;
} {
  const cached = getFresh(clientId);
  const [sessions, setSessions] = useState<TrainerSession[]>(cached ?? []);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    const fresh = getFresh(clientId);

    if (fresh) {
      setSessions(fresh);
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

      cacheByClient.set(clientId, { data: out, fetchedAt: Date.now() });
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
