// Formulario post-entreno del cliente: ¿lo tiene activado su entrenador? y
// ¿ya respondió para esta sesión? (ver lib/forms/workout.ts).

import { useQuery } from "@tanstack/react-query";

import { clientFetch } from "@/lib/auth/client-token-storage";
import { findWorkoutResponseForSession } from "@/lib/forms/workout";

export const workoutResponsesKey = (clientId: string, date: string) =>
  ["client", "formResponses", clientId, "workout", date] as const;

export function useWorkoutFeedback(
  clientId: string,
  date: string,
  sessionId: string
) {
  const enabledQuery = useQuery({
    queryKey: ["client", "formConfig", clientId, "workout"],
    queryFn: async (): Promise<boolean> => {
      const res = await clientFetch(
        `/api/forms/configs/${clientId}?form_type=workout`
      );

      // 404 = el entrenador no lo tiene activado.
      if (res.status === 404) return false;
      const body = await res.json().catch(() => null);

      if (!res.ok || body?.success !== true) {
        throw new Error(body?.error ?? `request_failed (${res.status})`);
      }

      return Boolean(body.config);
    },
    enabled: clientId.length > 0,
    staleTime: 5 * 60_000,
  });
  const enabled = enabledQuery.data === true;

  const responsesQuery = useQuery({
    queryKey: workoutResponsesKey(clientId, date),
    queryFn: async (): Promise<Array<{ metadata?: unknown }>> => {
      const res = await clientFetch(
        `/api/forms/responses/${clientId}?form_type=workout&start_date=${date}&end_date=${date}`
      );
      const body = await res.json().catch(() => null);

      if (!res.ok || body?.success !== true) {
        throw new Error(body?.error ?? `request_failed (${res.status})`);
      }

      return Array.isArray(body.responses) ? body.responses : [];
    },
    enabled: enabled && date.length > 0,
    staleTime: 60_000,
  });

  return {
    enabled,
    isReady: responsesQuery.isSuccess,
    answered:
      findWorkoutResponseForSession(responsesQuery.data ?? [], sessionId) !==
      null,
    refetch: responsesQuery.refetch,
  };
}
