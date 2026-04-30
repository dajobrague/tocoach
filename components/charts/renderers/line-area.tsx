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

import { avgNonNull, xAxisInterval } from "../utils";

import { resolveColor } from "@/lib/charts/palette";

const TOOLTIP_BOX_CLASS =
  "rounded-[10px] border-0 shadow-md text-xs text-gray-900 px-3 py-2 bg-white";

interface Props {
  buckets: BucketedPoint[];
  color: ColorToken;
  /** "line" or "area"; controls fill. */
  variant: "line" | "area";
  unit?: string;
  showAverageLine?: boolean;
  targetZone?: TargetZone;
  /** Stable id used to scope the gradient `<defs>`. */
  gradientId: string;
}

export function LineAreaRenderer({
  buckets,
  color,
  variant,
  unit,
  showAverageLine,
  targetZone,
  gradientId,
}: Props) {
  const palette = resolveColor(color);
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
        {variant === "area" ? (
          <defs>
            <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="5%" stopColor={palette.fill} stopOpacity={0.3} />
              <stop offset="95%" stopColor={palette.fill} stopOpacity={0} />
            </linearGradient>
          </defs>
        ) : null}
        <CartesianGrid
          stroke="#f3f4f6"
          strokeDasharray="3 3"
          vertical={false}
        />
        <XAxis
          angle={data.length > 10 ? -28 : 0}
          axisLine={false}
          dataKey="label"
          height={data.length > 10 ? 46 : 24}
          interval={xAxisInterval(data.length)}
          textAnchor={data.length > 10 ? "end" : "middle"}
          tick={{ fontSize: 9, fill: "#9ca3af" }}
          tickLine={false}
        />
        <YAxis
          axisLine={false}
          tick={{ fontSize: 10, fill: "#9ca3af" }}
          tickLine={false}
          {...(numeric.length > 0
            ? { domain: [min - domainPad, max + domainPad] as [number, number] }
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
              <div className={TOOLTIP_BOX_CLASS}>
                {row.periodTooltip ? (
                  <p className="text-[10px] text-gray-500 mb-1 leading-snug">
                    {row.periodTooltip}
                  </p>
                ) : null}
                <p className="text-[11px] text-gray-600 mb-0.5">{row.label}</p>
                <p className="text-sm font-semibold">
                  {row.value === undefined
                    ? "—"
                    : `${Number(row.value).toLocaleString("es-ES")}${unit ?? ""}`}
                </p>
              </div>
            );
          }}
          cursor={{ stroke: "#e5e7eb" }}
        />
        {avg !== null ? (
          <ReferenceLine
            label={{
              value: `${Math.round(avg)}${unit ?? ""}`,
              position: "right",
              fontSize: 9,
              fill: palette.stroke,
            }}
            stroke={palette.stroke}
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
              fill: palette.stroke,
              stroke: "#fff",
              strokeWidth: 2,
            }}
            dataKey="value"
            fill={`url(#${gradientId})`}
            stroke={palette.stroke}
            strokeWidth={2.5}
            type="monotone"
          />
        ) : (
          <Line
            connectNulls
            activeDot={{
              r: 4,
              fill: palette.stroke,
              stroke: "#fff",
              strokeWidth: 2,
            }}
            dataKey="value"
            dot={false}
            stroke={palette.stroke}
            strokeWidth={2.5}
            type="monotone"
          />
        )}
      </Renderer>
    </ResponsiveContainer>
  );
}
