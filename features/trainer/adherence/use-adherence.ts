"use client";

import type { AdherenceResult } from "@/lib/nutrition/logs/adherence-service";

import { useQuery } from "@tanstack/react-query";

async function fetchAdherence(
  clientId: number,
  from: string,
  to: string
): Promise<AdherenceResult> {
  const response = await fetch(
    `/api/clients/${clientId}/adherence?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    { credentials: "same-origin", cache: "no-store" }
  );
  const data = await response.json().catch(() => null);

  if (response.ok === false || data?.success !== true) {
    throw new Error(data?.error ?? `request_failed (${response.status})`);
  }

  return data.data as AdherenceResult;
}

/** Trainer-side adherence for one client over [from, to]. Trainer-session auth. */
export function useClientAdherence(clientId: number, from: string, to: string) {
  return useQuery({
    queryKey: ["adherence", clientId, from, to],
    queryFn: () => fetchAdherence(clientId, from, to),
    enabled: clientId > 0,
  });
}
