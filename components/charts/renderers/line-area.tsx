/**
 * Line and area chart renderer (the two are visually similar enough to
 * share — the only difference is whether the area below the stroke is
 * filled with a gradient).
 *
 * Single-series only. Multi-dim sources go through `stacked_bar` or `ring`.
 *
 * Mirrors today's WeightChart / ProteinChart visuals from
 * components/client-dashboard/progress-charts.tsx. Auto-domain padding
 * with a 15% buffer so the line never sits on the edge.
 */

"use client";

import type { BucketedPoint, ColorToken, TargetZone } from "@/lib/charts/types";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { avgNonNull, formatNumber, xAxisInterval } from "../utils";

import { INK, TOOLTIP_CLASSES } from "./ink";

import { resolveColor } from "@/lib/charts/palette";

interface Props {
  buckets: BucketedPoint[];
  color: ColorToken;
  /** "line" or "area"; controls fill. */
  variant: "line" | "area";
  unit?: string;
  showAverageLine?: boolean;
  targetZone?: TargetZone;
  /** Optional fixed Y-axis ceiling. */
  yMax?: number;
  /** Stable id used to scope the gradient `<defs>`. */
  gradientId: string;
  /**
   * Portal del cliente: línea/puntos en la tinta de marca, rejilla y ejes
   * con tokens del tema, y "area" con relleno plano (sin degradado).
   */
  ink?: boolean;
}

export function LineAreaRenderer({
  buckets,
  color,
  variant,
  unit,
  showAverageLine,
  targetZone,
  yMax,
  gradientId,
  ink = false,
}: Props) {
  const palette = resolveColor(color);
  const stroke = ink ? INK.mark : palette.stroke;
  const dotRing = ink ? INK.surface : "#fff";
  const tick = ink ? INK.tick : "#9ca3af";
  const tip = TOOLTIP_CLASSES[ink ? "ink" : "default"];
  // Recharts requires `value` to be `number | undefined`. Map nulls to
  // undefined and use connectNulls so gaps still draw a continuous line.
  const data = buckets.map((b) => ({
    label: b.label,
    value: typeof b.value === "number" ? b.value : undefined,
    periodTooltip: b.periodTooltip,
  }));

  const numeric = data
    .map((d) => d.value)
    .filter((v): v is number => typeof v === "number");
  const min = numeric.length ? Math.min(...numeric) : 0;
  const max = numeric.length ? Math.max(...numeric) : 1;
  const domainPad = Math.max((max - min) * 0.15, 0.5);
  const avg = showAverageLine ? avgNonNull(buckets) : null;

  const Renderer = variant === "area" ? AreaChart : LineChart;

  return (
    <ResponsiveContainer height={160} width="100%">
      <Renderer data={data} margin={{ top: 5, right: 5, left: -20, bottom: 4 }}>
        {variant === "area" && !ink ? (
          <defs>
            <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="5%" stopColor={palette.fill} stopOpacity={0.3} />
              <stop offset="95%" stopColor={palette.fill} stopOpacity={0} />
            </linearGradient>
          </defs>
        ) : null}
        <CartesianGrid
          stroke={ink ? INK.grid : "#f3f4f6"}
          strokeDasharray="3 3"
          vertical={false}
        />
        <XAxis
          angle={data.length > 8 ? -45 : 0}
          axisLine={false}
          dataKey="label"
          height={data.length > 8 ? 56 : 24}
          interval={xAxisInterval(data.length)}
          textAnchor={data.length > 8 ? "end" : "middle"}
          tick={{ fontSize: 9, fill: tick }}
          tickLine={false}
        />
        <YAxis
          axisLine={false}
          tick={{ fontSize: 10, fill: tick }}
          tickLine={false}
          {...(yMax !== undefined
            ? { domain: [0, yMax] as [number, number] }
            : numeric.length > 0
              ? {
                  domain: [min - domainPad, max + domainPad] as [
                    number,
                    number,
                  ],
                }
              : {})}
          {...(unit !== undefined ? { unit } : {})}
        />
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const row = payload[0]?.payload as {
              label?: string;
              value?: number;
              periodTooltip?: string;
            };

            return (
              <div className={tip.box}>
                {row.periodTooltip ? (
                  <p className={tip.period}>{row.periodTooltip}</p>
                ) : null}
                <p className={tip.label}>{row.label}</p>
                <p className="text-sm font-semibold">
                  {row.value === undefined
                    ? "—"
                    : `${formatNumber(Number(row.value), 2, 0)}${unit ?? ""}`}
                </p>
              </div>
            );
          }}
          cursor={{ stroke: ink ? INK.grid : "#e5e7eb" }}
        />
        {avg !== null ? (
          <ReferenceLine
            label={{
              value: `${Math.round(avg)}${unit ?? ""}`,
              position: "right",
              fontSize: 9,
              fill: ink ? INK.tick : palette.stroke,
            }}
            stroke={ink ? INK.tick : palette.stroke}
            strokeDasharray="5 3"
            strokeWidth={1.5}
            y={avg}
          />
        ) : null}
        {targetZone ? (
          <>
            <ReferenceLine
              stroke="#86efac"
              strokeDasharray="4 4"
              strokeWidth={1.5}
              y={targetZone.min}
            />
            <ReferenceLine
              stroke="#86efac"
              strokeDasharray="4 4"
              strokeWidth={1.5}
              y={targetZone.max}
            />
          </>
        ) : null}
        {variant === "area" ? (
          <Area
            connectNulls
            activeDot={{
              r: 4,
              fill: stroke,
              stroke: dotRing,
              strokeWidth: 2,
            }}
            dataKey="value"
            // Dot visible at every non-null point. With sparse data
            // (e.g. a single check-in in the range) the area gradient
            // can't fill between consecutive points, so without dots
            // the chart appears empty even though data exists. Recharts
            // skips dots for null/undefined values automatically.
            dot={{
              r: 2.5,
              fill: stroke,
              stroke: dotRing,
              strokeWidth: 1.5,
            }}
            fill={ink ? INK.mark : `url(#${gradientId})`}
            fillOpacity={ink ? 0.08 : 1}
            stroke={stroke}
            strokeWidth={2.5}
            type="monotone"
          />
        ) : (
          <Line
            connectNulls
            activeDot={{
              r: 4,
              fill: stroke,
              stroke: dotRing,
              strokeWidth: 2,
            }}
            dataKey="value"
            // Dot visible at every non-null point so single / sparse
            // values still render. Recharts skips dots for null values.
            dot={{
              r: 2.5,
              fill: stroke,
              stroke: dotRing,
              strokeWidth: 1.5,
            }}
            stroke={stroke}
            strokeWidth={2.5}
            type="monotone"
          />
        )}
      </Renderer>
    </ResponsiveContainer>
  );
}
