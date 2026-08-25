// Hook de fetching del microciclo configurado por el trainer para un
// cliente. Wrappea GET /api/clients/[clientId]/microcycle.

import type { MicrocycleWithSlots, Session } from "@/types/training";

import { useQuery } from "@tanstack/react-query";

export type AvailableTrainerSession = Session & { exercise_count: number };

/** Sesión referenciada por un slot pero de un programa NO activo: el
    cliente no la ve (pausar = ocultar). El editor la etiqueta como oculta. */
export interface HiddenSlotSession {
  id: string;
  name: string;
  session_type: string | null;
  program_name: string | null;
  /** true = el cliente no la ve; false = solo fuera del scope del trainer
      (el cliente sí la ve) — se usa para decidir si pintar el badge. */
  is_hidden: boolean;
}

export interface TrainerMicrocycleData {
  microcycle: MicrocycleWithSlots | null;
  available_sessions: AvailableTrainerSession[];
  hidden_sessions: HiddenSlotSession[];
  program: { id: string; name: string } | null;
  start_date: string | null;
}

interface ApiResponse {
  success: boolean;
  microcycle: MicrocycleWithSlots | null;
  available_sessions: AvailableTrainerSession[];
  hidden_sessions?: HiddenSlotSession[];
  program: { id: string; name: string } | null;
  start_date: string | null;
  error?: string;
}

async function fetchTrainerMicrocycle(
  clientId: string
): Promise<TrainerMicrocycleData> {
  const response = await fetch(`/api/clients/${clientId}/microcycle`);
  const data = (await response.json()) as ApiResponse;

  if (!response.ok || !data.success) {
    throw new Error(data.error ?? "Error al cargar el microciclo");
  }

  return {
    microcycle: data.microcycle,
    available_sessions: data.available_sessions,
    hidden_sessions: data.hidden_sessions ?? [],
    program: data.program,
    start_date: data.start_date,
  };
}

export function useTrainerMicrocycle(clientId: string) {
  return useQuery({
    queryKey: ["trainer", "microcycle", clientId],
    queryFn: () => fetchTrainerMicrocycle(clientId),
    staleTime: 30_000,
  });
}

export const TRAINER_MICROCYCLE_QUERY_KEY = (clientId: string) =>
  ["trainer", "microcycle", clientId] as const;
