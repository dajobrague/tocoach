// Hook que carga el microciclo del programa activo del cliente con los
// descansos implícitos ya expandidos (lo hace el endpoint del lado
// servidor). Si el entrenador todavía no ha armado el microciclo, el
// response devuelve { microcycle: null } y la UI oculta el enlace
// "Ver mi microciclo".

import type { MicrocycleSlotView } from "@/types/training";

import { useQuery } from "@tanstack/react-query";

import { clientFetch } from "@/lib/auth/client-token-storage";

export interface ClientMicrocycleData {
  duration_days: number;
  slots: MicrocycleSlotView[];
}

interface ApiResponse {
  success: boolean;
  microcycle: ClientMicrocycleData | null;
  error?: string;
}

async function fetchMicrocycle(): Promise<ClientMicrocycleData | null> {
  const response = await clientFetch("/api/client/microcycle");
  const data = (await response.json()) as ApiResponse;

  if (!response.ok || !data.success) {
    throw new Error(data.error ?? "Error al cargar el microciclo");
  }

  return data.microcycle;
}

export function useMicrocycle() {
  return useQuery({
    queryKey: ["client", "microcycle"],
    queryFn: fetchMicrocycle,
    staleTime: 60_000,
  });
}
