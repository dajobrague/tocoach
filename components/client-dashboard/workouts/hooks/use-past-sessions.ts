// Hook que devuelve los entrenamientos completados del cliente en los
// últimos N días. Reusa GET /api/client/calendar (mismo dato, una sola
// fuente para el cliente).

import type { SessionType } from "@/types/training";

import { useQuery } from "@tanstack/react-query";

import { clientFetch } from "@/lib/auth/client-token-storage";
import { getLocalTodayYmd, getLocalYmd } from "@/lib/forms/client-helpers";

const DEFAULT_LOOKBACK_DAYS = 30;
const DEFAULT_DISPLAY_LIMIT = 14;

export interface PastSession {
  id: string;
  scheduled_date: string;
  name: string;
  session_type: SessionType | null;
  exercises_completed: number;
  exercises_total: number;
}

interface CalendarApiSession {
  id: string;
  name: string;
  session_type: SessionType | null;
  exercises_completed: number;
  exercises_total: number;
}

interface CalendarApiEntry {
  scheduled_date: string;
  sessions: CalendarApiSession[];
}

interface ApiResponse {
  success: boolean;
  entries: CalendarApiEntry[];
  error?: string;
}

async function fetchPastSessions(): Promise<PastSession[]> {
  const today = new Date();
  const start = new Date(today);

  start.setDate(today.getDate() - DEFAULT_LOOKBACK_DAYS);

  const params = new URLSearchParams({
    from: getLocalYmd(start),
    to: getLocalTodayYmd(),
  });

  const response = await clientFetch(
    `/api/client/calendar?${params.toString()}`
  );
  const data = (await response.json()) as ApiResponse;

  if (!response.ok || !data.success) {
    throw new Error(data.error ?? "Error al cargar el historial");
  }

  // Aplana entries → array de PastSession ordenado por fecha desc.
  const flat: PastSession[] = [];

  for (const entry of data.entries) {
    for (const s of entry.sessions) {
      flat.push({
        id: `${entry.scheduled_date}-${s.id}`,
        scheduled_date: entry.scheduled_date,
        name: s.name,
        session_type: s.session_type,
        exercises_completed: s.exercises_completed,
        exercises_total: s.exercises_total,
      });
    }
  }

  flat.sort((a, b) => (a.scheduled_date < b.scheduled_date ? 1 : -1));

  return flat.slice(0, DEFAULT_DISPLAY_LIMIT);
}

export function usePastSessions() {
  return useQuery({
    queryKey: ["client", "past-sessions"],
    queryFn: fetchPastSessions,
    staleTime: 60_000,
  });
}
