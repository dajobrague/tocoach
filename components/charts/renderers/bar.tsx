/**
 * Bar chart renderer.
 *
 * 1-D data only. If `targetZone` is set, each bar is colored per-bucket
 * using `resolveTargetZoneFill` (red below min - margin, yellow in margin
 * band, green inside zone, light green above max). If `showAverageLine`
 * is true, a dashed reference line at the period mean is drawn.
 *
 * Mirrors today's SleepChart and CaloriesChart.
 */

"use client";

import type { BucketedPoint, ColorToken, TargetZone } from "@/lib/charts/types";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { avgNonNull, xAxisInterval } from "../utils";

import { resolveColor, resolveTargetZoneFill } from "@/lib/charts/palette";

const TOOLTIP_BOX_CLASS =
  "rounded-[10px] border-0 shadow-md text-xs text-gray-900 px-3 py-2 bg-white";

interface Props {
  buckets: BucketedPoint[];
  color: ColorToken;
  unit?: string;
  showAverageLine?: boolean;
  targetZone?: TargetZone;
  /** Optional fixed Y-axis ceiling (e.g. 10 for rating-style metrics). */
  yMax?: number;
}

export function BarRenderer({
  buckets,
  color,
  unit,
  showAverageLine,
  targetZone,
  yMax,
}: Props) {
  const palette = resolveColor(color);
  const data = buckets.map((b) => ({
    label: b.label,
    value: typeof b.value === "number" ? b.value : 0,
    hasValue: typeof b.value === "number",
    periodTooltip: b.periodTooltip,
  }));
  const avg = showAverageLine ? avgNonNull(buckets) : null;

  // ComposedChart so we can layer a ReferenceLine over the bars cleanly,
  // matching today's CaloriesChart visual.
  const Renderer = showAverageLine ? ComposedChart : BarChart;

  return (
    <ResponsiveContainer height={160} width="100%">
      <Renderer data={data} margin={{ top: 5, right: 5, left: -20, bottom: 4 }}>
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
          allowDecimals={false}
          axisLine={false}
          tick={{ fontSize: 10, fill: "#9ca3af" }}
          tickLine={false}
          {...(yMax !== undefined
            ? { domain: [0, yMax] as [number, number] }
            : {})}
          {...(unit !== undefined ? { unit } : {})}
        />
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const row = payload[0]?.payload as {
              label?: string;
              value?: number;
              hasValue?: boolean;
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
                  {row.hasValue
                    ? `${Number(row.value).toLocaleString("es-ES")}${unit ?? ""}`
                    : "—"}
                </p>
              </div>
            );
          }}
          cursor={{ fill: "rgba(243,244,246,0.6)" }}
        />
        {targetZone && targetZone.margin && targetZone.margin > 0 ? (
          <ReferenceLine
            stroke="#86efac"
            strokeDasharray="4 4"
            strokeWidth={1.5}
            y={targetZone.min}
          />
        ) : null}
        {avg !== null ? (
          <ReferenceLine
            label={{
              value: `${Math.round(avg)}`,
              position: "right",
              fontSize: 9,
              fill: "#a78bfa",
            }}
            stroke="#a78bfa"
            strokeDasharray="5 3"
            strokeWidth={1.5}
            y={avg}
          />
        ) : null}
        <Bar dataKey="value" radius={[3, 3, 0, 0]}>
          {data.map((d, i) => {
            let fill = palette.fill;

            if (!d.hasValue) {
              fill = "#d1d5db";
            } else if (targetZone) {
              fill = resolveTargetZoneFill(d.value, targetZone);
            }

            return <Cell key={i} fill={fill} />;
          })}
        </Bar>
      </Renderer>
    </ResponsiveContainer>
  );
}
