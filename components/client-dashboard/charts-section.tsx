/**
 * Client-side charts section — replacement for the bespoke charts in
 * `progress-charts.tsx`. Mounted by `dashboard-content.tsx` when the
 * `USE_NEW_CHART_SYSTEM` flag is on.
 *
 * Why a separate component (not a direct ChartSurface mount):
 *   - The client app authenticates via `client-session` cookie OR
 *     `Authorization: Bearer` header (Safari ITP / iframe fallback).
 *     `clientFetch` from lib/auth/client-token-storage is what knows how
 *     to attach the bearer when the cookie is blocked.
 *   - The trainer-side hooks in lib/charts/hooks.ts use bare `fetch` with
 *     cookie auth only. Reusing them in the iframe-embedded client app
 *     would silently 401 when ITP strips the cookie.
 *
 * So this component talks to the snapshot endpoint via clientFetch and
 * renders ChartCards directly. No edit affordances (read-only).
 */

"use client";

import type {
  BucketedPoint,
  ChartConfig,
  ChartsDocument,
} from "@/lib/charts/types";

import { Card, CardBody } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";

import { ChartCard } from "@/components/charts/chart-card";
import { clientFetch } from "@/lib/auth/client-token-storage";
import { resolveAdapter } from "@/lib/charts/registry";

interface SnapshotResponse {
  success: boolean;
  data?: {
    source: "override" | "template";
    effective_charts: ChartsDocument;
    schedule: unknown;
    range: { from: string; to: string };
    buckets: Record<
      string,
      {
        buckets: BucketedPoint[];
        aggregationFallback: boolean;
      }
    >;
  };
  error?: string;
}

interface Props {
  clientId: string | number;
  /** Period key from the existing dashboard selector (7d/30d/3m/6m/12m). */
  selectedPeriod: string;
}

async function fetchSnapshot(
  clientId: string | number,
  range: string
): Promise<SnapshotResponse["data"]> {
  const res = await clientFetch(
    `/api/charts/clients/${clientId}/snapshot?range=${encodeURIComponent(range)}`,
    { cache: "no-store" }
  );
  const json = (await res.json()) as SnapshotResponse;

  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.error ?? `request_failed (${res.status})`);
  }

  return json.data;
}

export function ChartsSection({ clientId, selectedPeriod }: Props) {
  const query = useQuery({
    queryKey: ["client", "chartsSnapshot", String(clientId), selectedPeriod],
    queryFn: () => fetchSnapshot(clientId, selectedPeriod),
    enabled: !!clientId,
    // Charts data is fairly fresh; reuse for 60s before background refetch.
    staleTime: 60 * 1000,
  });

  if (query.isLoading) {
    return (
      <div className="space-y-4">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i}>
            <CardBody className="p-4">
              <div className="h-3 w-1/2 bg-default-100 rounded animate-pulse mb-2" />
              <div className="h-8 w-1/3 bg-default-100 rounded animate-pulse mb-3" />
              <div className="h-[140px] w-full bg-default-100 rounded animate-pulse" />
            </CardBody>
          </Card>
        ))}
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <Card>
        <CardBody className="p-4 text-center">
          <p className="text-xs text-foreground/50">
            No se pudieron cargar las gráficas. Inténtalo más tarde.
          </p>
        </CardBody>
      </Card>
    );
  }

  const { effective_charts, buckets } = query.data;

  if (effective_charts.charts.length === 0) {
    // Trainer hasn't configured any charts (and there's no template).
    // Render nothing — the parent renders other dashboard surfaces.
    return null;
  }

  return (
    <div className="space-y-4">
      {effective_charts.charts.map((chart: ChartConfig) => {
        const adapter = resolveAdapter(chart.source);
        const bucketEntry = buckets[chart.id];
        const chartBuckets: BucketedPoint[] = bucketEntry?.buckets ?? [];
        const series = adapter?.metadata.series?.map((s) => ({
          id: s.id,
          label: s.label,
        }));

        return (
          <ChartCard
            key={chart.id}
            buckets={chartBuckets}
            config={chart}
            {...(adapter?.metadata.icon !== undefined
              ? { icon: adapter.metadata.icon }
              : {})}
            {...(adapter?.metadata.unit !== undefined
              ? { unit: adapter.metadata.unit }
              : {})}
            {...(adapter?.metadata.y_max !== undefined
              ? { yMax: adapter.metadata.y_max }
              : {})}
            orphan={!adapter}
            {...(series !== undefined ? { series } : {})}
          />
        );
      })}
    </div>
  );
}
