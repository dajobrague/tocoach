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

import { avgNonNull, formatNumber, xAxisInterval } from "../utils";

import { INK, INK_PAST_OPACITY, TOOLTIP_CLASSES } from "./ink";

import { resolveColor, resolveTargetZoneFill } from "@/lib/charts/palette";

interface Props {
  buckets: BucketedPoint[];
  color: ColorToken;
  unit?: string;
  showAverageLine?: boolean;
  targetZone?: TargetZone;
  /** Optional fixed Y-axis ceiling (e.g. 10 for rating-style metrics). */
  yMax?: number;
  /**
   * Portal del cliente: barras en la tinta de marca (las anteriores al
   * 35 %, la última plena), rejilla y ejes con tokens del tema.
   */
  ink?: boolean;
}

export function BarRenderer({
  buckets,
  color,
  unit,
  showAverageLine,
  targetZone,
  yMax,
  ink = false,
}: Props) {
  const palette = resolveColor(color);
  const tick = ink ? INK.tick : "#9ca3af";
  const tip = TOOLTIP_CLASSES[ink ? "ink" : "default"];
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
          allowDecimals={false}
          axisLine={false}
          tick={{ fontSize: 10, fill: tick }}
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
              <div className={tip.box}>
                {row.periodTooltip ? (
                  <p className={tip.period}>{row.periodTooltip}</p>
                ) : null}
                <p className={tip.label}>{row.label}</p>
                <p className="text-sm font-semibold">
                  {row.hasValue
                    ? `${formatNumber(Number(row.value), 2, 0)}${unit ?? ""}`
                    : "—"}
                </p>
              </div>
            );
          }}
          cursor={{ fill: ink ? INK.cursor : "rgba(243,244,246,0.6)" }}
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
              fill: ink ? INK.tick : "#a78bfa",
            }}
            stroke={ink ? INK.tick : "#a78bfa"}
            strokeDasharray="5 3"
            strokeWidth={1.5}
            y={avg}
          />
        ) : null}
        <Bar dataKey="value" radius={ink ? [4, 4, 4, 4] : [3, 3, 0, 0]}>
          {data.map((d, i) => {
            let fill = ink ? INK.mark : palette.fill;

            if (!d.hasValue) {
              fill = ink ? INK.grid : "#d1d5db";
            } else if (targetZone) {
              fill = resolveTargetZoneFill(d.value, targetZone);
            }

            // Tinta: solo la barra actual va plena (la zona objetivo
            // conserva su semáforo a opacidad completa).
            const fillOpacity =
              ink && d.hasValue && !targetZone && i !== data.length - 1
                ? INK_PAST_OPACITY
                : 1;

            return <Cell key={i} fill={fill} fillOpacity={fillOpacity} />;
          })}
        </Bar>
      </Renderer>
    </ResponsiveContainer>
  );
}
