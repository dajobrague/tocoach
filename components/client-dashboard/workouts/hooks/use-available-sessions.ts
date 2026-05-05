// Hook que lista las sesiones del programa activo del cliente. Wrappea
// GET /api/client/sessions. Sin programa activo el endpoint devuelve
// { program: null, sessions: [] } y el hook lo expone igual para que
// la UI muestre empty state.

import type { SessionType } from "@/types/training";

import { useQuery } from "@tanstack/react-query";

import { clientFetch } from "@/lib/auth/client-token-storage";

export interface AvailableSession {
  id: string;
  name: string;
  session_type: SessionType | null;
  duration_minutes: number | null;
  exercise_count: number;
  program_id?: string; // presente cuando hay >1 programa activo (fuerza+cardio)
}

export interface ProgramSummary {
  id: string;
  name: string;
}

export interface AvailableSessionsData {
  program: ProgramSummary | null;
  programs: ProgramSummary[];
  sessions: AvailableSession[];
}

interface ApiResponse {
  success: boolean;
  program: ProgramSummary | null;
  programs?: ProgramSummary[];
  sessions: AvailableSession[];
  error?: string;
}

async function fetchAvailableSessions(): Promise<AvailableSessionsData> {
  const response = await clientFetch("/api/client/sessions");
  const data = (await response.json()) as ApiResponse;

  if (!response.ok || !data.success) {
    throw new Error(data.error ?? "Error al cargar las sesiones disponibles");
  }

  return {
    program: data.program,
    programs: data.programs ?? (data.program ? [data.program] : []),
    sessions: data.sessions,
  };
}

export function useAvailableSessions() {
  return useQuery({
    queryKey: ["client", "available-sessions"],
    queryFn: fetchAvailableSessions,
    staleTime: 60_000,
  });
}
