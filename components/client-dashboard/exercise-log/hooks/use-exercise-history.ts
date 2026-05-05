// Hook que carga el historial del ejercicio para el cliente autenticado.
// Wrappea GET /api/client/exercises/:exerciseId/history y devuelve las
// últimas N sesiones + el PR (mejor marca histórica) calculado al
// vuelo desde exercise_log_sets.

import type { ExerciseHistoryResponse } from "@/types/training";

import { useQuery } from "@tanstack/react-query";

import { clientFetch } from "@/lib/auth/client-token-storage";

interface ApiResponse extends ExerciseHistoryResponse {
  success: boolean;
  error?: string;
}

async function fetchExerciseHistory(
  exerciseId: string,
  limit: number
): Promise<ExerciseHistoryResponse> {
  const params = new URLSearchParams({ limit: String(limit) });
  const response = await clientFetch(
    `/api/client/exercises/${exerciseId}/history?${params.toString()}`
  );
  const data = (await response.json()) as ApiResponse;

  if (!response.ok || !data.success) {
    throw new Error(data.error ?? "Error al cargar el historial del ejercicio");
  }

  return {
    exercise_id: data.exercise_id,
    recent: data.recent,
    pr: data.pr,
  };
}

export function useExerciseHistory(
  exerciseId: string | null,
  options: { limit?: number; enabled?: boolean } = {}
) {
  const limit = options.limit ?? 3;
  const enabled = options.enabled !== false && Boolean(exerciseId);

  return useQuery({
    queryKey: ["client", "exercise-history", exerciseId, limit] as const,
    queryFn: () => fetchExerciseHistory(exerciseId as string, limit),
    enabled,
    staleTime: 30_000,
  });
}
