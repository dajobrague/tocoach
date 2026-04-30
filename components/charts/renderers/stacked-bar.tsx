/**
 * Stacked bar renderer.
 *
 * Multi-dim only. Source must declare `series[]`; this renderer reads
 * each bucket's `value` as a `Record<seriesId, number | null>`. Renders
 * one stacked bar per bucket with one color per series, plus a centered
 * legend below.
 *
 * Mirrors today's TrainingActivityChart.
 */

"use client";

import type { BucketedPoint, ColorToken } from "@/lib/charts/types";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { xAxisInterval } from "../utils";

import { resolveColor } from "@/lib/charts/palette";

const TOOLTIP_BOX_CLASS =
  "rounded-[10px] border-0 shadow-md text-xs text-gray-900 px-3 py-2 bg-white";

interface SeriesSpec {
  id: string;
  label: string;
}

interface Props {
  buckets: BucketedPoint[];
  /** One per series; same length and order as the adapter's `series[]`. */
  colors: ColorToken[];
  /** From the adapter metadata; used for tooltip + legend. */
  series: ReadonlyArray<SeriesSpec>;
}

export function StackedBarRenderer({ buckets, colors, series }: Props) {
  // Flatten each bucket into a row { label, periodTooltip, <seriesId>: number }
  const data = buckets.map((b) => {
    const row: Record<string, string | number | undefined> = {
      label: b.label,
      periodTooltip: b.periodTooltip,
    };

    if (typeof b.value === "object" && b.value !== null) {
      for (const s of series) {
        const v = (b.value as Record<string, number | null | undefined>)[s.id];

        row[s.id] = typeof v === "number" ? v : 0;
      }
    } else {
      for (const s of series) row[s.id] = 0;
    }

    return row;
  });

  return (
    <div>
      <ResponsiveContainer height={160} width="100%">
        <BarChart
          data={data}
          margin={{ top: 5, right: 5, left: -20, bottom: 4 }}
        >
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
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const row = payload[0]?.payload as Record<
                string,
                string | number | undefined
              >;

              return (
                <div className={TOOLTIP_BOX_CLASS}>
                  {row.periodTooltip ? (
                    <p className="text-[10px] text-gray-500 mb-1 leading-snug">
                      {String(row.periodTooltip)}
                    </p>
                  ) : null}
                  <p className="text-[11px] text-gray-600 mb-1">
                    {String(row.label)}
                  </p>
                  {series.map((s) => (
                    <p key={s.id} className="text-sm">
                      {s.label}: {Number(row[s.id] ?? 0)}
                    </p>
                  ))}
                </div>
              );
            }}
            cursor={{ fill: "rgba(243,244,246,0.6)" }}
          />
          {series.map((s, i) => {
            const palette = resolveColor(
              colors[i] ?? colors[colors.length - 1]!
            );

            return (
              <Bar
                key={s.id}
                barSize={12}
                dataKey={s.id}
                fill={palette.stroke}
                radius={[3, 3, 0, 0]}
                stackId="a"
              />
            );
          })}
        </BarChart>
      </ResponsiveContainer>
      <div className="flex items-center gap-4 mt-1 justify-center flex-wrap">
        {series.map((s, i) => {
          const palette = resolveColor(colors[i] ?? colors[colors.length - 1]!);

          return (
            <div key={s.id} className="flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-sm"
                style={{ backgroundColor: palette.stroke }}
              />
              <span className="text-[10px] text-foreground/50">{s.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
