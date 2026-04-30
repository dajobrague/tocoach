/**
 * <ChartCard>
 *
 * The wrapping card that <ChartSurface> repeats per chart in the grid.
 * Owns the visible header (label, current value, icon) and dispatches to
 * one of the four states: skeleton, empty, orphan, error, or rendered chart.
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
import { iconForChartType, latestNonNull, formatNumber } from "./utils";

import { resolveColor } from "@/lib/charts/palette";

interface Props {
  config: ChartConfig;
  buckets: BucketedPoint[] | undefined;
  orphan?: boolean;
  icon?: string;
  unit?: string;
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

function CardEmpty({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-40 gap-2 text-foreground/30">
      <Icon icon="solar:chart-2-linear" width={28} />
      <p className="text-xs font-medium">{message}</p>
    </div>
  );
}

function CardOrphan() {
  return (
    <div className="flex flex-col items-center justify-center h-40 gap-2 text-foreground/40">
      <Icon icon="solar:link-broken-bold" width={28} />
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
  const colorToken = Array.isArray(config.color)
    ? config.color[0]!
    : config.color;
  const palette = resolveColor(colorToken);

  const isLoading = buckets === undefined;
  const isEmpty =
    !isLoading &&
    !orphan &&
    Array.isArray(buckets) &&
    (buckets.length === 0 ||
      buckets.every(
        (b) => b.value === null || b.value === undefined || b.value === 0
      ));

  return (
    <Card className="relative" radius="lg" shadow="sm">
      {editable && editOverlay ? (
        <div className="absolute top-2 right-2 z-10 flex items-center gap-1">
          {editOverlay}
        </div>
      ) : null}
      <CardBody>
        {/* Header: label + current value + icon. KPI hides the value here
            because the body itself IS the big number. */}
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-semibold text-foreground/70 tracking-wide">
            {config.label}
          </p>
          <div
            className="p-1.5 rounded-full"
            style={{ backgroundColor: palette.soft }}
          >
            <Icon
              icon={resolvedIcon}
              style={{ color: palette.stroke }}
              width={16}
            />
          </div>
        </div>
        {config.chart_type !== "kpi" ? (
          <p className="text-4xl font-bold mb-3 text-foreground tabular-nums">
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

        {/* State branches */}
        {orphan ? (
          <CardOrphan />
        ) : isLoading ? (
          <CardSkeleton />
        ) : isEmpty ? (
          <CardEmpty message="Sin datos" />
        ) : (
          <ChartErrorBoundary chartId={config.id}>
            <ChartRenderer
              buckets={buckets!}
              config={config}
              {...(series !== undefined ? { series } : {})}
            />
          </ChartErrorBoundary>
        )}
      </CardBody>
    </Card>
  );
}
