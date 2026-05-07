/**
 * <ChartCard>
 *
 * The wrapping card that <ChartSurface> repeats per chart in the grid.
 * Owns the visible header (label, current value, icon) and dispatches to
 * one of three states: skeleton (loading), orphan (deleted source), or the
 * rendered chart. When the rendered chart has no data we keep the chart
 * silhouette visible and overlay a "Sin datos aún" watermark on top —
 * never collapse to a blank card.
 *
 * Inputs:
 *   config       — the ChartConfig (label, source, chart_type, color, …)
 *   buckets      — undefined while loading; an array (possibly empty) once loaded
 *   orphan       — true when the source can't be resolved (form question deleted)
 *   icon         — overrides the icon shown in the header (catalog adapter
 *                  metadata.icon); falls back to `iconForChartType(config.chart_type)`
 *   unit         — optional unit suffix (from the resolved adapter)
 *   series       — multi-dim adapter series list (required for stacked_bar/ring)
 *   editable     — when true, mounts the edit overlay children (rendered above
 *                  the card body). Phase 5 wires this up.
 *   editOverlay  — the edit-overlay node (pencil/up/down/delete buttons)
 */

"use client";

import type { BucketedPoint, ChartConfig } from "@/lib/charts/types";

import { Icon } from "@iconify/react";
import { Card, CardBody } from "@heroui/react";
import { useMemo } from "react";

import { ChartErrorBoundary } from "./error-boundary";
import { ChartRenderer } from "./chart-renderer";
import {
  iconForChartType,
  isBucketsEmpty,
  latestNonNull,
  formatNumber,
} from "./utils";

import { resolveColor } from "@/lib/charts/palette";

interface Props {
  config: ChartConfig;
  buckets: BucketedPoint[] | undefined;
  orphan?: boolean;
  icon?: string;
  unit?: string;
  /** Forwarded to the renderer; comes from adapter.metadata.y_max. */
  yMax?: number;
  series?: ReadonlyArray<{ id: string; label: string }>;
  editable?: boolean;
  editOverlay?: React.ReactNode;
}

function CardSkeleton() {
  return (
    <div className="space-y-2">
      <div className="h-3 w-1/2 bg-default-100 rounded animate-pulse" />
      <div className="h-8 w-1/3 bg-default-100 rounded animate-pulse" />
      <div className="h-[140px] w-full bg-default-100 rounded animate-pulse" />
    </div>
  );
}

function NoDataOverlay() {
  // Sits absolutely on top of the rendered chart silhouette (axes + grid)
  // when all values are null/0, so the user sees the chart shape with a
  // "no hay datos aún" hint instead of a fully empty box.
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 pointer-events-none rounded-md bg-content1/55 backdrop-blur-[1px]">
      <Icon
        className="text-foreground/30"
        icon="solar:chart-2-linear"
        width={26}
      />
      <p className="text-[11px] font-medium text-foreground/45 tracking-wide">
        Sin datos aún
      </p>
    </div>
  );
}

function CardOrphan() {
  return (
    <div className="flex flex-col items-center justify-center h-40 gap-2 text-foreground/40">
      <Icon icon="solar:close-circle-bold" width={28} />
      <p className="text-xs font-medium">Esta pregunta ya no existe</p>
      <p className="text-[10px] text-foreground/30">
        Edita la gráfica para elegir otra fuente
      </p>
    </div>
  );
}

export function ChartCard({
  config,
  buckets,
  orphan,
  icon,
  unit,
  yMax,
  series,
  editable,
  editOverlay,
}: Props) {
  // The header's "current value" is the latest non-null for 1-D charts;
  // ring (range_total) shows the sum of its series; kpi shows nothing in
  // the header (the body is already the big number).
  const headerValue = useMemo(() => {
    if (!buckets || buckets.length === 0) return null;
    if (config.chart_type === "ring") {
      const b = buckets[0];

      if (b && typeof b.value === "object" && b.value !== null) {
        let total = 0;

        for (const v of Object.values(
          b.value as Record<string, number | null | undefined>
        )) {
          if (typeof v === "number") total += v;
        }

        return total === 0 ? null : Math.round(total);
      }

      return null;
    }
    if (config.chart_type === "stacked_bar" || config.chart_type === "kpi") {
      return null;
    }

    return latestNonNull(buckets);
  }, [buckets, config.chart_type]);

  // Header icon: prefer an explicit metadata icon, fall back to the chart-type one.
  const resolvedIcon = icon ?? iconForChartType(config.chart_type);
  // Fallback a `neutral-slate` si el array está vacío (config corrupta
  // del trainer). Antes era `[0]!` que puede dar undefined en runtime
  // y crashear `resolveColor` — ahora degrada gracefully al gris neutro.
  const colorToken = Array.isArray(config.color)
    ? (config.color[0] ?? "neutral-slate")
    : config.color;
  const palette = resolveColor(colorToken);

  const isLoading = buckets === undefined;
  // The chart still renders its silhouette (axes/grid) when empty; a
  // watermark overlay is added on top — see NoDataOverlay below. The
  // emptiness rule is shared with ChartsSection's pendientes-checklist
  // grouping (see utils.isBucketsEmpty) so the two paths never drift.
  const noData =
    !isLoading && !orphan && Array.isArray(buckets) && isBucketsEmpty(buckets);

  return (
    <Card className="relative" radius="lg" shadow="sm">
      <CardBody>
        {/* Header: icon (left) + label + current value below. Edit overlay
            sits to the right of the label, separate from the metric icon. */}
        <div className="flex items-center justify-between mb-1 gap-2 min-h-[28px]">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className="p-1.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: palette.soft }}
            >
              <Icon
                icon={resolvedIcon}
                style={{ color: palette.stroke }}
                width={16}
              />
            </div>
            <p className="text-xs font-semibold text-foreground/70 tracking-wide truncate">
              {config.label}
            </p>
          </div>
          {editable && editOverlay ? (
            <div className="flex items-center gap-1 flex-shrink-0">
              {editOverlay}
            </div>
          ) : null}
        </div>
        {config.chart_type !== "kpi" ? (
          <p
            className={`text-4xl font-bold mb-3 tabular-nums ${
              noData ? "text-foreground/30" : "text-foreground"
            }`}
          >
            {headerValue === null
              ? isLoading
                ? ""
                : "—"
              : formatNumber(headerValue, headerValue >= 100 ? 0 : 1)}
            {headerValue !== null && unit ? (
              <span className="text-base text-foreground/40 ml-1 font-medium">
                {unit}
              </span>
            ) : null}
          </p>
        ) : null}

        {/* State branches.
            We intentionally render the chart silhouette even when there is
            no data — Recharts draws axes + grid for null values, and the
            ring/kpi renderers have their own empty-state visuals. The
            watermark sits on top via <NoDataOverlay /> so the card never
            collapses to "blank". */}
        {orphan ? (
          <CardOrphan />
        ) : isLoading ? (
          <CardSkeleton />
        ) : (
          <div className="relative">
            <ChartErrorBoundary chartId={config.id}>
              <ChartRenderer
                buckets={buckets!}
                config={config}
                {...(series !== undefined ? { series } : {})}
                {...(yMax !== undefined ? { yMax } : {})}
              />
            </ChartErrorBoundary>
            {noData ? <NoDataOverlay /> : null}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
