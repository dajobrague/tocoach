import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { clientFetch } from "@/lib/auth/client-token-storage";

// ─── Date helpers ───────────────────────────────────────────────────────────

function getDateRange() {
  const today = new Date();
  const startDate = new Date(today);

  startDate.setDate(today.getDate() - 14);
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

  return data.success ? data.responses || [] : [];
}

async function fetchNeatCards() {
  const response = await clientFetch("/api/client/neat");
  const data = await response.json();

  return data.success ? data.cards || [] : [];
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
