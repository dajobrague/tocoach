/**
 * React Query hooks for the chart system.
 *
 * Trainer-side hooks use plain fetch (cookie auth is automatic, SameSite=Lax).
 * Client-side hooks use clientFetch (cookie + Bearer fallback for iframe/Safari ITP).
 *
 * The mutation hooks invalidate the right caches on success — surface
 * components don't need to think about it.
 */

"use client";

import type { ChartDataSource, ChartsDocument } from "./types";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// ─── Trainer template ──────────────────────────────────────────────────────

export interface TemplateData {
  id: string;
  charts: ChartsDocument;
  auto_apply_to_new_clients: boolean;
  updated_at: string;
}

interface ApiOk<T> {
  success: true;
  data: T;
}

interface ApiErr {
  success: false;
  error: string;
  details?: unknown;
}

/**
 * Send a 401 to /trainer/login so the user is bounced cleanly instead of
 * sitting on a broken page while React Query retries.
 */
function handleUnauthorized(): void {
  if (typeof window === "undefined") return;
  if (window.location.pathname.startsWith("/trainer/login")) return;
  window.location.replace("/trainer/login");
}

async function apiGet<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "same-origin" });

  if (res.status === 401) {
    handleUnauthorized();
    throw new Error("unauthorized (401)");
  }
  const json = (await res.json()) as ApiOk<T> | ApiErr;

  if (!res.ok || !json.success) {
    throw new Error(
      ((json as ApiErr).error ?? "request_failed") + ` (${res.status})`
    );
  }

  return (json as ApiOk<T>).data;
}

interface PutResult<T> {
  data: T;
  etagConflict?: { current_updated_at: string };
}

async function apiPut<T>(
  url: string,
  body: unknown,
  ifMatch?: string
): Promise<PutResult<T>> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };

  if (ifMatch) headers["if-match"] = ifMatch;
  const res = await fetch(url, {
    method: "PUT",
    credentials: "same-origin",
    headers,
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as
    | ApiOk<T>
    | (ApiErr & {
        current_updated_at?: string;
      });

  if (res.status === 409) {
    return {
      data: undefined as unknown as T,
      etagConflict: {
        current_updated_at: (json as { current_updated_at?: string })
          .current_updated_at!,
      },
    };
  }
  if (!res.ok || !json.success) {
    const err = json as ApiErr;

    throw new Error(`${err.error ?? "request_failed"} (${res.status})`);
  }

  return { data: (json as ApiOk<T>).data };
}

async function apiPost<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    credentials: "same-origin",
    headers: body ? { "content-type": "application/json" } : {},
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const json = (await res.json()) as ApiOk<T> | ApiErr;

  if (!res.ok || !json.success) {
    throw new Error(
      ((json as ApiErr).error ?? "request_failed") + ` (${res.status})`
    );
  }

  return (json as ApiOk<T>).data;
}

async function apiDelete<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    method: "DELETE",
    credentials: "same-origin",
  });
  const json = (await res.json()) as ApiOk<T> | ApiErr;

  if (!res.ok || !json.success) {
    throw new Error(
      ((json as ApiErr).error ?? "request_failed") + ` (${res.status})`
    );
  }

  return (json as ApiOk<T>).data;
}

// ─── Hooks: trainer template ──────────────────────────────────────────────

export function useChartTemplate(options: { enabled?: boolean } = {}) {
  const { enabled = true } = options;

  return useQuery({
    queryKey: ["charts", "template"],
    queryFn: () => apiGet<TemplateData>("/api/charts/template"),
    enabled,
    retry: (failureCount, err) => {
      // Don't retry auth errors — handleUnauthorized already redirected.
      if (err instanceof Error && err.message.includes("401")) return false;

      return failureCount < 2;
    },
  });
}

export interface UpdateTemplateBody {
  charts: ChartsDocument;
  auto_apply_to_new_clients?: boolean;
}

export function useUpdateChartTemplate() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (vars: UpdateTemplateBody & { ifMatch?: string }) => {
      const { ifMatch, ...body } = vars;

      return apiPut<TemplateData>("/api/charts/template", body, ifMatch);
    },
    onSuccess: (result) => {
      if (result.etagConflict) return; // caller handles
      qc.setQueryData(["charts", "template"], result.data);
    },
  });
}

export function useApplyToAll() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: () =>
      apiPost<{ affected: number }>("/api/charts/template/apply-to-all"),
    onSuccess: () => {
      // Per-client overrides are now gone; their effective config is the
      // template again. Invalidate any snapshot/per-client query just in case.
      qc.invalidateQueries({ queryKey: ["charts", "client"] });
    },
  });
}

// ─── Hooks: data sources ───────────────────────────────────────────────────

export function useDataSources() {
  return useQuery({
    queryKey: ["charts", "data-sources"],
    queryFn: () => apiGet<ChartDataSource[]>("/api/charts/data-sources"),
    staleTime: 5 * 60 * 1000, // catalog rarely changes during a session
    retry: (failureCount, err) => {
      if (err instanceof Error && err.message.includes("401")) return false;

      return failureCount < 2;
    },
  });
}

// ─── Hooks: per-client (used by phase 6) ──────────────────────────────────

export interface ClientChartsData {
  source: "override" | "template";
  charts: ChartsDocument;
  updated_at: string;
}

export function useClientCharts(clientId: number | string) {
  return useQuery({
    queryKey: ["charts", "client", String(clientId)],
    queryFn: () => apiGet<ClientChartsData>(`/api/charts/clients/${clientId}`),
    enabled: clientId !== "" && clientId !== 0,
  });
}

export function useUpdateClientCharts(clientId: number | string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (vars: { charts: ChartsDocument; ifMatch?: string }) => {
      const { ifMatch, ...body } = vars;

      return apiPut<{ id: string; charts: ChartsDocument; updated_at: string }>(
        `/api/charts/clients/${clientId}`,
        body,
        ifMatch
      );
    },
    onSuccess: (result) => {
      if (result.etagConflict) return;
      qc.invalidateQueries({
        queryKey: ["charts", "client", String(clientId)],
      });
      // Invalidar también el snapshot para que el preview del trainer
      // muestre datos reales del cliente inmediatamente tras el
      // autosave, en lugar de quedarse con la demo data que se renderiza
      // mientras la mutación está in-flight. Mismo patrón que ya hace
      // `useResetClientCharts` abajo.
      qc.invalidateQueries({
        queryKey: ["charts", "snapshot", String(clientId)],
      });
    },
  });
}

export function useResetClientCharts(clientId: number | string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: () =>
      apiDelete<{ deleted: boolean }>(`/api/charts/clients/${clientId}`),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ["charts", "client", String(clientId)],
      });
      qc.invalidateQueries({
        queryKey: ["charts", "snapshot", String(clientId)],
      });
    },
  });
}

// ─── Hooks: snapshot (config + bucketed data) ─────────────────────────────

export interface SnapshotData {
  source: "override" | "template";
  effective_charts: ChartsDocument;
  schedule: unknown;
  range: { from: string; to: string };
  /** Bucketed values keyed by ChartConfig.id. */
  buckets: Record<
    string,
    {
      buckets: Array<{
        label: string;
        value: number | null | Record<string, number | null>;
        periodTooltip?: string;
      }>;
      aggregationFallback: boolean;
    }
  >;
}

export type ChartRange = "7d" | "30d" | "90d" | "6m" | "12m";

export function useClientSnapshot(
  clientId: number | string,
  range: ChartRange = "30d"
) {
  return useQuery({
    queryKey: ["charts", "snapshot", String(clientId), range],
    queryFn: () => {
      // Mismo motivo que en charts-section.tsx (lado cliente):
      // mandamos browser tz para que el server alinee los buckets
      // diarios/weekly/biweekly/monthly al calendario del usuario que
      // está mirando — en este caso el trainer. Sin esto el server
      // defaultea a UTC y los buckets se desfasan cerca de medianoche
      // local del trainer.
      let tz = "UTC";

      try {
        tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      } catch {
        // browsers muy viejos sin Intl — fallback a UTC.
      }

      return apiGet<SnapshotData>(
        `/api/charts/clients/${clientId}/snapshot?range=${range}&tz=${encodeURIComponent(tz)}`
      );
    },
    enabled: clientId !== "" && clientId !== 0,
    retry: (failureCount, err) => {
      if (err instanceof Error && err.message.includes("401")) return false;

      return failureCount < 2;
    },
  });
}
