/**
 * Client-side charts section. Renders los charts del template/override
 * que configuró el entrenador, mostrando agrupados al final los que aún
 * no tienen datos (ver `<PendingChartsCard>`).
 *
 * Por qué este componente vive separado de `<ChartSurface>`:
 *   - La app de cliente autentica vía cookie `client-session` O bien
 *     `Authorization: Bearer` (fallback para Safari ITP / iframe).
 *     `clientFetch` (lib/auth/client-token-storage) sabe cuándo adjuntar
 *     el bearer si la cookie viene bloqueada.
 *   - Los hooks del lado entrenador (lib/charts/hooks.ts) usan `fetch`
 *     pelado con auth de cookie; en el iframe del cliente harían 401
 *     silencioso cuando ITP borra la cookie.
 *
 * Por eso este componente llama al snapshot endpoint vía clientFetch y
 * monta `<ChartCard>` directo. Read-only — sin affordances de edición.
 */

"use client";

import type {
  BucketedPoint,
  ChartConfig,
  ChartsDocument,
} from "@/lib/charts/types";

import { Icon } from "@iconify/react";
import { Card, CardBody } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";

import { ChartCard } from "@/components/charts/chart-card";
import { iconForChartType, isBucketsEmpty } from "@/components/charts/utils";
import { clientFetch } from "@/lib/auth/client-token-storage";
import { resolveColor } from "@/lib/charts/palette";
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
  // Pasamos la tz del browser para que el server compute el rango de
  // fechas (fromYmd/toYmd del filtro SQL) en el huso del cliente. Sin
  // esto, un cliente en LATAM/Pacífico que registra cerca de
  // medianoche local podía quedar fuera del rango calculado en UTC y
  // su submit no aparecía en charts hasta el día siguiente.
  let tz = "UTC";

  try {
    tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    // browsers muy viejos sin Intl — fallback a UTC.
  }

  const res = await clientFetch(
    `/api/charts/clients/${clientId}/snapshot?range=${encodeURIComponent(range)}&tz=${encodeURIComponent(tz)}`,
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

  // Partition: charts with data (or orphans, which need their own visible
  // state) render as full cards; charts whose buckets evaluate empty get
  // collapsed into a single "Aún sin registrar" checklist at the bottom,
  // so the client doesn't see 4-5 stacked empty canvases on day one.
  type Enriched = {
    chart: ChartConfig;
    buckets: BucketedPoint[];
    adapter: ReturnType<typeof resolveAdapter>;
    series: ReadonlyArray<{ id: string; label: string }> | undefined;
  };

  const enriched: Enriched[] = effective_charts.charts.map((chart) => {
    const adapter = resolveAdapter(chart.source);
    const bucketEntry = buckets[chart.id];
    const chartBuckets: BucketedPoint[] = bucketEntry?.buckets ?? [];
    const series = adapter?.metadata.series?.map((s) => ({
      id: s.id,
      label: s.label,
    }));

    return { chart, buckets: chartBuckets, adapter, series };
  });

  const isEmpty = (e: Enriched) => !!e.adapter && isBucketsEmpty(e.buckets);
  const visibleCharts = enriched.filter((e) => !isEmpty(e));
  const pendingCharts = enriched.filter(isEmpty);

  return (
    <div className="space-y-4">
      {visibleCharts.map(
        ({ chart, buckets: chartBuckets, adapter, series }) => (
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
        )
      )}

      {pendingCharts.length > 0 ? (
        <PendingChartsCard charts={pendingCharts} period={selectedPeriod} />
      ) : null}
    </div>
  );
}

interface PendingChartsCardProps {
  charts: ReadonlyArray<{
    chart: ChartConfig;
    adapter: ReturnType<typeof resolveAdapter>;
  }>;
  period: string;
}

/**
 * Compact checklist that replaces the stack of empty chart canvases.
 * Each row keeps the trainer's metric color + icon so when data starts
 * coming in the row "graduates" to a full <ChartCard> with continuity.
 */
function PendingChartsCard({ charts, period }: PendingChartsCardProps) {
  return (
    <Card radius="lg" shadow="sm">
      <CardBody>
        <p className="text-xs font-semibold text-foreground/55 tracking-wide">
          Aún sin registrar
        </p>
        <p className="text-[11px] text-foreground/40 mt-0.5">
          Registra para ver tu progreso aquí
        </p>
        <ul className="mt-3 divide-y divide-default-100/60">
          {charts.map(({ chart, adapter }) => {
            const colorToken = Array.isArray(chart.color)
              ? (chart.color[0] ?? "neutral-slate")
              : chart.color;
            const palette = resolveColor(colorToken);
            const icon =
              adapter?.metadata.icon ?? iconForChartType(chart.chart_type);

            return (
              <li
                key={chart.id}
                className="flex items-center gap-3 py-2.5 min-h-[48px]"
              >
                <div
                  className="p-1.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: palette.soft }}
                >
                  <Icon
                    aria-hidden
                    icon={icon}
                    style={{ color: palette.stroke }}
                    width={16}
                  />
                </div>
                <p className="text-xs font-semibold text-foreground/70 tracking-wide truncate flex-1">
                  {chart.label}
                </p>
                <p className="text-[10px] text-foreground/40 tabular-nums flex-shrink-0">
                  Sin datos · {period}
                </p>
              </li>
            );
          })}
        </ul>
      </CardBody>
    </Card>
  );
}
