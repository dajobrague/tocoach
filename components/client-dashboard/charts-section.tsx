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
  ChartDataSource,
  BucketedPoint,
  ChartConfig,
  ChartsDocument,
  PhotoPoint,
} from "@/lib/charts/types";

import { useQuery } from "@tanstack/react-query";

import { ChartCard } from "@/components/charts/chart-card";
import { iconForChartType, isBucketsEmpty } from "@/components/charts/utils";
import { IconTile } from "@/components/shared/icon-tile";
import { clientFetch } from "@/lib/auth/client-token-storage";
import { resolveAdapter } from "@/lib/charts/registry";

interface SnapshotResponse {
  success: boolean;
  data?: {
    source: "override" | "template";
    effective_charts: ChartsDocument;
    sources?: ChartDataSource[];
    schedule: unknown;
    range: { from: string; to: string };
    buckets: Record<
      string,
      {
        buckets: BucketedPoint[];
        aggregationFallback: boolean;
      }
    >;
    photoBuckets?: Record<string, { photos: PhotoPoint[] }>;
  };
  error?: string;
}

/** Período del selector → texto del pie de cada gráfica ("Media de 7 días"). */
const PERIOD_LABELS: Record<string, string> = {
  "7d": "7 días",
  "14d": "14 días",
  "30d": "30 días",
  "3m": "3 meses",
  "6m": "6 meses",
  "12m": "12 meses",
};

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

  const periodLabel = PERIOD_LABELS[selectedPeriod] ?? selectedPeriod;

  if (query.isLoading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            aria-hidden
            className="rounded-large bg-content1 p-4 shadow-small"
          >
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-[10px] bg-default-100 motion-safe:animate-pulse" />
              <div className="h-3.5 w-1/3 rounded bg-default-100 motion-safe:animate-pulse" />
            </div>
            <div className="mt-3.5 h-8 w-1/3 rounded bg-default-100 motion-safe:animate-pulse" />
            <div className="mt-3 h-[140px] w-full rounded bg-default-100 motion-safe:animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <div className="rounded-large bg-content1 p-4 text-center shadow-small">
        <p className="text-sm text-default-500">
          No se pudieron cargar las gráficas. Inténtalo más tarde.
        </p>
      </div>
    );
  }

  const { effective_charts, buckets, photoBuckets, sources } = query.data;

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
    photos: PhotoPoint[] | undefined;
    adapter: ReturnType<typeof resolveAdapter>;
    series: ReadonlyArray<{ id: string; label: string }> | undefined;
  };

  const enriched: Enriched[] = effective_charts.charts.map((chart) => {
    const adapter = resolveAdapter(chart.source, { sources });
    const bucketEntry = buckets[chart.id];
    const chartBuckets: BucketedPoint[] = bucketEntry?.buckets ?? [];
    const photos =
      chart.chart_type === "photo_timeline"
        ? (photoBuckets?.[chart.id]?.photos ?? [])
        : undefined;
    const series = adapter?.metadata.series?.map((s) => ({
      id: s.id,
      label: s.label,
    }));

    return { chart, buckets: chartBuckets, photos, adapter, series };
  });

  // Photo timeline charts have their own empty state inside the
  // renderer, so they never get bundled into the "Aún sin registrar"
  // checklist — they always render as a full card.
  const isEmpty = (e: Enriched) =>
    e.chart.chart_type !== "photo_timeline" &&
    !!e.adapter &&
    isBucketsEmpty(e.buckets);
  const visibleCharts = enriched.filter((e) => !isEmpty(e));
  const pendingCharts = enriched.filter(isEmpty);

  return (
    <div className="space-y-3">
      {visibleCharts.map(
        ({ chart, buckets: chartBuckets, photos, adapter, series }) => (
          <ChartCard
            key={chart.id}
            buckets={chartBuckets}
            config={chart}
            {...(photos !== undefined ? { photos } : {})}
            {...(chart.icon !== undefined
              ? { icon: chart.icon }
              : adapter?.metadata.icon !== undefined
                ? { icon: adapter.metadata.icon }
                : {})}
            {...(adapter?.metadata.unit !== undefined
              ? { unit: adapter.metadata.unit }
              : {})}
            {...(adapter?.metadata.y_max !== undefined
              ? { yMax: adapter.metadata.y_max }
              : {})}
            {...(adapter?.metadata.rating === true ? { rating: true } : {})}
            orphan={!adapter}
            {...(series !== undefined ? { series } : {})}
            periodLabel={periodLabel}
            variant="client"
          />
        )
      )}

      {pendingCharts.length > 0 ? (
        <PendingChartsCard charts={pendingCharts} period={periodLabel} />
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
 * Each row keeps the metric icon so when data starts coming in the row
 * "graduates" to a full <ChartCard> with continuity (same brand tile).
 */
function PendingChartsCard({ charts, period }: PendingChartsCardProps) {
  return (
    <div className="rounded-large bg-content1 p-4 shadow-small">
      <p className="text-[15px] font-semibold text-foreground">
        Aún sin registrar
      </p>
      <p className="mt-0.5 text-[13px] text-default-500">
        Registra para ver tu progreso aquí
      </p>
      <ul className="mt-2 divide-y divide-default-100">
        {charts.map(({ chart, adapter }) => {
          const icon =
            chart.icon ??
            adapter?.metadata.icon ??
            iconForChartType(chart.chart_type);

          return (
            <li
              key={chart.id}
              className="flex min-h-[52px] items-center gap-3 py-2.5"
            >
              <IconTile
                className="!h-8 !w-8 !rounded-[10px]"
                icon={icon}
                size="sm"
              />
              <p className="min-w-0 flex-1 truncate text-[15px] font-medium text-foreground">
                {chart.label}
              </p>
              <p className="flex-shrink-0 text-[13px] tabular-nums text-default-500">
                Sin datos · {period}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
