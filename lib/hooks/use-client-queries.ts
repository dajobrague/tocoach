import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { clientFetch } from "@/lib/auth/client-token-storage";

// ─── Date helpers ───────────────────────────────────────────────────────────

function getDateRange() {
  const today = new Date();
  const startDate = new Date(today);

  // -30d aguanta el selector de semana del cliente (que permite hasta
  // 30 días atrás) — sin esto, el progreso de sesiones pasadas se vería
  // vacío al abrir un día más viejo de 14 días.
  startDate.setDate(today.getDate() - 30);
  const endDate = new Date(today);

  endDate.setDate(today.getDate() + 21);

  return {
    startDate: startDate.toISOString().split("T")[0],
    endDate: endDate.toISOString().split("T")[0],
  };
}

function getDateDaysAgo(days: number): string {
  const date = new Date();

  date.setDate(date.getDate() - days);

  return date.toISOString().split("T")[0] || "";
}

// ─── Bootstrap fetcher (client profile + tenant context in one call) ────────

export interface ClientBootstrapData {
  clientId: string;
  firstName: string;
  lastName: string;
  logoUrl: string;
  trainerName: string;
  clientProfilePicture: string;
  tenantSlug: string;
  communityUrl: string | null;
}

async function fetchBootstrap(): Promise<ClientBootstrapData | null> {
  const response = await clientFetch("/api/client/bootstrap");

  // Not authenticated — return null so the query "succeeds" with no data.
  // This avoids caching an error state that sticks after login.
  if (response.status === 401) {
    return null;
  }

  const data = await response.json();

  if (!data.success) {
    throw new Error(data.error || "Error al cargar datos de inicio");
  }

  return data.data as ClientBootstrapData;
}

export function useClientBootstrap() {
  return useQuery<ClientBootstrapData | null>({
    queryKey: ["client", "bootstrap"],
    queryFn: fetchBootstrap,
    // Profile / tenant context rarely changes — keep fresh for 5 min
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

// ─── Fetcher functions ──────────────────────────────────────────────────────

async function fetchPrograms() {
  const response = await clientFetch("/api/client/programs");
  const data = await response.json();

  if (!data.success) throw new Error(data.error || "Error al cargar programas");

  return data.programs || [];
}

async function fetchExerciseLogs(clientId: string) {
  const { startDate, endDate } = getDateRange();
  const response = await clientFetch(
    `/api/clients/${clientId}/exercise-logs?startDate=${startDate}&endDate=${endDate}`
  );
  const data = await response.json();

  return data.success ? data.exerciseLogs || [] : [];
}

async function fetchScheduledSessions(clientId: string) {
  const { startDate, endDate } = getDateRange();
  const response = await clientFetch(
    `/api/clients/${clientId}/scheduled-sessions?startDate=${startDate}&endDate=${endDate}`
  );
  const data = await response.json();

  return data.success ? data.scheduledSessions || [] : [];
}

async function fetchNutritionPlan() {
  const response = await clientFetch("/api/client/nutrition");
  const data = await response.json();

  if (!data.success) return null;

  return data.data && data.data.length > 0 ? data.data : null;
}

async function fetchSupplements() {
  const response = await clientFetch("/api/client/supplements");
  const data = await response.json();

  if (!data.success)
    throw new Error(data.error || "Error al cargar suplementos");

  return data.data || [];
}

async function fetchFormResponses(
  clientId: string,
  formType: string,
  startDate: string
) {
  const response = await clientFetch(
    `/api/forms/responses/${clientId}?form_type=${formType}&start_date=${startDate}`
  );
  const data = await response.json();

  // Throw en `!success` para que TanStack marque `isError`. Antes
  // devolvíamos `[]` silenciosamente y la home no podía detectar
  // fallos del backend (banner danger en dashboard-content depende
  // de esto). Mismo patrón que `fetchSnapshot` en charts-section.
  if (!response.ok || !data.success) {
    throw new Error(data.error ?? `request_failed (${response.status})`);
  }

  return data.responses || [];
}

async function fetchNeatCards() {
  const response = await clientFetch("/api/client/neat");
  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.error ?? `request_failed (${response.status})`);
  }

  return data.cards || [];
}

// ─── Query hooks ────────────────────────────────────────────────────────────

export function usePrograms() {
  return useQuery({
    queryKey: ["client", "programs"],
    queryFn: fetchPrograms,
  });
}

export function useExerciseLogs(clientId: string) {
  return useQuery({
    queryKey: ["client", "exerciseLogs", clientId],
    queryFn: () => fetchExerciseLogs(clientId),
    enabled: !!clientId,
  });
}

export function useScheduledSessions(clientId: string) {
  return useQuery({
    queryKey: ["client", "scheduledSessions", clientId],
    queryFn: () => fetchScheduledSessions(clientId),
    enabled: !!clientId,
  });
}

export function useNutritionPlan() {
  return useQuery({
    queryKey: ["client", "nutrition"],
    queryFn: fetchNutritionPlan,
  });
}

export function useSupplements() {
  return useQuery({
    queryKey: ["client", "supplements"],
    queryFn: fetchSupplements,
  });
}

export function useFormResponses(
  clientId: string,
  formType: string,
  days: number
) {
  const startDate = getDateDaysAgo(days);

  return useQuery({
    queryKey: ["client", "formResponses", clientId, formType, startDate],
    queryFn: () => fetchFormResponses(clientId, formType, startDate),
    enabled: !!clientId,
  });
}

export function useNeatCards() {
  return useQuery({
    queryKey: ["client", "neatCards"],
    queryFn: fetchNeatCards,
  });
}

// ─── Mutation hooks ─────────────────────────────────────────────────────────

export function useLogExercise(clientId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (requestBody: any) => {
      const response = await clientFetch(
        `/api/clients/${clientId}/exercise-logs`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        }
      );
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Error al guardar registro");
      }

      return data;
    },
    onSuccess: () => {
      // Invalidate exercise logs so they refetch in the background.
      // The UI keeps showing the current (stale) data during refetch —
      // no spinner, no content flash.
      queryClient.invalidateQueries({
        queryKey: ["client", "exerciseLogs", clientId],
      });
    },
  });
}

// Borra exercise_logs del cliente. Soporta dos modos:
//   { logId } → borra un solo registro
//   { sessionId, scheduledDate } → borra todos los logs de una sesión
//                                  en una fecha específica
// Después de borrar invalida exerciseLogs y past-sessions para que la
// UI refleje el cambio sin recarga manual.
export function useDeleteExerciseLogs(clientId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      args: { logId: string } | { sessionId: string; scheduledDate: string }
    ) => {
      const params = new URLSearchParams();

      if ("logId" in args) {
        params.set("logId", args.logId);
      } else {
        params.set("sessionId", args.sessionId);
        params.set("scheduledDate", args.scheduledDate);
      }
      const response = await clientFetch(
        `/api/clients/${clientId}/exercise-logs?${params.toString()}`,
        { method: "DELETE" }
      );
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Error al borrar registro");
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["client", "exerciseLogs", clientId],
      });
      queryClient.invalidateQueries({
        queryKey: ["client", "past-sessions"],
      });
    },
  });
}

export function useRescheduleSession(clientId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (requestBody: any) => {
      const response = await clientFetch(
        `/api/clients/${clientId}/scheduled-sessions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        }
      );
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Error al reprogramar");
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["client", "scheduledSessions", clientId],
      });
    },
  });
}
