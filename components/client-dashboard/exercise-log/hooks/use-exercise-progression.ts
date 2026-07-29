// Hook que carga la progresión (e1RM + récords por rango de reps) del
// ejercicio para el cliente autenticado. Wrappea
// GET /api/client/exercises/:exerciseId/progression y comparte los tipos
// con el cálculo del server (lib/training/*), así que cliente y
// entrenador ven exactamente los mismos números.

import type { Progression } from "@/lib/training/progression-query";

import { useQuery } from "@tanstack/react-query";

import { clientFetch } from "@/lib/auth/client-token-storage";

interface ApiResponse {
  success: boolean;
  progression?: Progression;
  error?: string;
}

const EMPTY: Progression = {
  e1rmSeries: [],
  repMaxes: [],
  currentE1rm: null,
  bestE1rm: null,
  totalSessions: 0,
};

async function fetchProgression(
  exerciseId: string,
  days: number
): Promise<Progression> {
  const params = new URLSearchParams({ days: String(days) });
  const response = await clientFetch(
    `/api/client/exercises/${exerciseId}/progression?${params.toString()}`
  );
  const data = (await response.json()) as ApiResponse;

  if (!response.ok || !data.success) {
    throw new Error(
      data.error ?? "Error al cargar la progresión del ejercicio"
    );
  }

  return data.progression ?? EMPTY;
}

export function useExerciseProgression(
  exerciseId: string | null,
  options: { days?: number; enabled?: boolean } = {}
) {
  const days = options.days ?? 365;
  const enabled = options.enabled !== false && Boolean(exerciseId);

  return useQuery({
    queryKey: ["client", "exercise-progression", exerciseId, days] as const,
    queryFn: () => fetchProgression(exerciseId as string, days),
    enabled,
    staleTime: 30_000,
  });
}
