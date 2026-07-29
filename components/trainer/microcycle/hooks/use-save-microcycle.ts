// Hook de mutación para guardar el microciclo. Wrappea PUT
// /api/clients/[clientId]/microcycle. Invalida la query de fetch al
// éxito para refrescar la pantalla con la versión guardada.

import type { MicrocycleWithSlots } from "@/types/training";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";

import { TRAINER_MICROCYCLE_QUERY_KEY } from "./use-trainer-microcycle";

export interface SaveMicrocycleInput {
  duration_days: number;
  /** Fecha (YYYY-MM-DD) que el trainer eligió como "Día 1" del ciclo. */
  start_date: string;
  slots: Array<{ day_index: number; session_id: string | null }>;
}

interface ApiResponse {
  success: boolean;
  microcycle?: MicrocycleWithSlots;
  error?: string;
}

async function putMicrocycle(
  clientId: string,
  input: SaveMicrocycleInput
): Promise<MicrocycleWithSlots> {
  const response = await fetch(`/api/clients/${clientId}/microcycle`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = (await response.json()) as ApiResponse;

  if (!response.ok || !data.success || !data.microcycle) {
    throw new Error(data.error ?? "Error al guardar el microciclo");
  }

  return data.microcycle;
}

export function useSaveMicrocycle(clientId: string) {
  const queryClient = useQueryClient();
  // Cadena de serialización: cada guardado manda el ciclo COMPLETO, así que
  // el último en dispararse debe ser el último en llegar al server. Sin esto,
  // clicks rápidos (+día, ×día) lanzaban PUTs concurrentes y uno viejo podía
  // aterrizar último y persistir estado obsoleto.
  const chainRef = useRef<Promise<unknown>>(Promise.resolve());

  return useMutation({
    mutationFn: (input: SaveMicrocycleInput) => {
      const run = chainRef.current
        .catch(() => undefined)
        .then(() => putMicrocycle(clientId, input));

      chainRef.current = run;

      return run;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: TRAINER_MICROCYCLE_QUERY_KEY(clientId),
      });
    },
  });
}
