"use client";

// Hook react-query de la rebanada "Progreso". Una entrada de cache por
// (cliente, ejercicio, ventana): cambiar de rango 3M/1A/2A es una query nueva,
// no un refetch destructivo, así que volver a un rango ya visto es instantáneo.
// Sin toasts: el error sube como ProgresoApiError y lo pinta la sección.

import type { Progression } from "./progreso-api";

import { useQuery } from "@tanstack/react-query";

import { fetchProgression } from "./progreso-api";

export const progressionKey = (
  clientId: string,
  exerciseId: string | null,
  days: number
) => ["progression", clientId, exerciseId, days] as const;

export interface UseProgression {
  progression: Progression | null;
  isLoading: boolean;
  error: unknown;
  refetch: () => void;
}

/** Progresión de un ejercicio; inerte mientras no haya ejercicio elegido. */
export function useProgression(
  clientId: string,
  exerciseId: string | null,
  days: number
): UseProgression {
  const query = useQuery<Progression>({
    queryKey: progressionKey(clientId, exerciseId, days),
    // `enabled` garantiza que exerciseId no es null cuando esto corre.
    queryFn: () => fetchProgression(clientId, exerciseId as string, days),
    enabled: exerciseId !== null,
    staleTime: 60_000,
  });

  return {
    progression: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
    refetch: () => {
      void query.refetch();
    },
  };
}
