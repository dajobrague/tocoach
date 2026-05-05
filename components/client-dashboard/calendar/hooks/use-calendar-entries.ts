// Hook que carga los entrenamientos completados del cliente en un rango.
// Wrappea GET /api/client/calendar y devuelve los datos indexados por
// fecha YYYY-MM-DD para que las grids hagan lookup O(1) por celda.

import type { SessionType } from "@/types/training";

import { useQuery } from "@tanstack/react-query";

import { clientFetch } from "@/lib/auth/client-token-storage";

export interface CalendarEntrySession {
  id: string;
  name: string;
  session_type: SessionType | null;
  exercises_completed: number;
  exercises_total: number;
}

interface CalendarApiEntry {
  scheduled_date: string;
  sessions: CalendarEntrySession[];
}

interface ApiResponse {
  success: boolean;
  entries: CalendarApiEntry[];
  error?: string;
}

export interface CalendarEntriesData {
  byDate: Map<string, CalendarEntrySession[]>;
  totalSessions: number;
}

async function fetchCalendarEntries(
  from: string,
  to: string
): Promise<CalendarEntriesData> {
  const params = new URLSearchParams({ from, to });
  const response = await clientFetch(
    `/api/client/calendar?${params.toString()}`
  );
  const data = (await response.json()) as ApiResponse;

  if (!response.ok || !data.success) {
    throw new Error(data.error ?? "Error al cargar el calendario");
  }

  const byDate = new Map<string, CalendarEntrySession[]>();
  let total = 0;

  for (const entry of data.entries) {
    byDate.set(entry.scheduled_date, entry.sessions);
    total += entry.sessions.length;
  }

  return { byDate, totalSessions: total };
}

export function useCalendarEntries(args: { from: string; to: string }) {
  return useQuery({
    queryKey: ["client", "calendar", args.from, args.to] as const,
    queryFn: () => fetchCalendarEntries(args.from, args.to),
    staleTime: 60_000,
  });
}
