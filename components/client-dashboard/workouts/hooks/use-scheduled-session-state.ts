// Estado servidor de la sesión activa (fila scheduled_sessions de esta
// fecha+sesión): hora de inicio declarada y completado manual. Alimenta el
// chip "Empezaste a las HH:MM" y el botón "Marcar como completado" de la
// vista de sesión activa (pedidos de la llamada del 15 Jul).

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { clientFetch } from "@/lib/auth/client-token-storage";

export interface ScheduledSessionState {
  scheduledSessionId: string;
  status: string;
  scheduled_time: string | null;
  completedManually: boolean;
}

const stateKey = (date: string, sessionId: string) =>
  ["client", "scheduled-state", date, sessionId] as const;

async function fetchState(
  date: string,
  sessionId: string
): Promise<ScheduledSessionState | null> {
  const res = await clientFetch(
    `/api/client/scheduled-sessions/${date}/state?sessionId=${encodeURIComponent(sessionId)}`
  );
  const body = await res.json().catch(() => null);

  if (!res.ok || body?.success !== true) {
    throw new Error(body?.error ?? `request_failed (${res.status})`);
  }

  return (body.data as ScheduledSessionState | null) ?? null;
}

export function useScheduledSessionState(date: string, sessionId: string) {
  return useQuery({
    queryKey: stateKey(date, sessionId),
    queryFn: () => fetchState(date, sessionId),
    enabled: date.length > 0 && sessionId.length > 0,
    staleTime: 30_000,
  });
}

/** POST /start — declara (o corrige) la hora de inicio del entrenamiento. */
export function useSetStartTime(date: string, sessionId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (time: string) => {
      const res = await clientFetch(
        `/api/client/scheduled-sessions/${date}/start`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, time }),
        }
      );
      const body = await res.json().catch(() => null);

      if (!res.ok || body?.success !== true) {
        throw new Error(body?.error ?? `request_failed (${res.status})`);
      }

      return body.data as {
        scheduledSessionId: string;
        scheduled_time: string;
      };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: stateKey(date, sessionId) });
    },
  });
}

/** POST /complete — marcar (o desmarcar con undo) el entrenamiento completo. */
export function useMarkSessionCompleted(date: string, sessionId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: { undo?: boolean } = {}) => {
      const res = await clientFetch(
        `/api/client/scheduled-sessions/${date}/complete`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            ...(input.undo === true ? { undo: true } : {}),
          }),
        }
      );
      const body = await res.json().catch(() => null);

      if (!res.ok || body?.success !== true) {
        throw new Error(body?.error ?? `request_failed (${res.status})`);
      }

      return body.data as {
        scheduledSessionId: string | null;
        status: string | null;
        completedManually: boolean;
      };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: stateKey(date, sessionId) });
      // El calendario y los conteos de sesión muestran el status — refrescar.
      qc.invalidateQueries({ queryKey: ["client", "calendar"] });
      qc.invalidateQueries({ queryKey: ["client", "resolved-day", date] });
    },
  });
}

/** Hora local actual como "HH:MM" (para el default al iniciar). */
export function nowHHMM(): string {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");

  return `${hh}:${mm}`;
}
