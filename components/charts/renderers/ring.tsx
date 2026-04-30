/**
 * Ring renderer (conic-gradient donut).
 *
 * Multi-dim only. Always range_total — exactly one bucket whose `value`
 * is a `Record<seriesId, number | null>`. Renders a percentage breakdown
 * as a conic gradient with a centered total + per-series legend.
 *
 * Mirrors today's MacrosRing.
 */

"use client";

import type { BucketedPoint, ColorToken } from "@/lib/charts/types";

import { resolveColor } from "@/lib/charts/palette";

interface SeriesSpec {
  id: string;
  label: string;
}

interface Props {
  buckets: BucketedPoint[];
  colors: ColorToken[];
  series: ReadonlyArray<SeriesSpec>;
  /** Optional unit suffix shown after the total ("g", "kcal", etc.). */
  unit?: string;
}

export function RingRenderer({ buckets, colors, series, unit }: Props) {
  // ring is range_total — one bucket. If empty, render the empty circle.
  const bucket = buckets[0];
  const seriesValues: Record<string, number> = {};

  if (bucket && typeof bucket.value === "object" && bucket.value !== null) {
    for (const s of series) {
      const v = (bucket.value as Record<string, number | null | undefined>)[
        s.id
      ];

      seriesValues[s.id] = typeof v === "number" ? v : 0;
    }
  } else {
    for (const s of series) seriesValues[s.id] = 0;
  }

  const total = series.reduce((s, sp) => s + (seriesValues[sp.id] ?? 0), 0);

  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-32 gap-2 text-foreground/30">
        <div className="w-20 h-20 rounded-full border-4 border-dashed border-foreground/10" />
        <p className="text-xs font-medium">Sin datos</p>
      </div>
    );
  }

  // Build conic gradient stops in series order.
  let cursor = 0;
  const stops: string[] = [];
  const legend: Array<{
    label: string;
    g: number;
    pct: number;
    color: string;
    bgClass: string;
  }> = [];

  series.forEach((s, i) => {
    const value = seriesValues[s.id] ?? 0;
    const pct = total > 0 ? (value / total) * 100 : 0;
    const deg = (value / total) * 360;
    const palette = resolveColor(colors[i] ?? colors[colors.length - 1]!);

    stops.push(`${palette.stroke} ${cursor}deg ${cursor + deg}deg`);
    legend.push({
      label: s.label,
      g: Math.round(value),
      pct: Math.round(pct),
      color: palette.stroke,
      bgClass: "",
    });
    cursor += deg;
  });
  const gradient = `conic-gradient(${stops.join(", ")})`;

  return (
    <div className="flex items-center gap-5 mt-3">
      <div className="relative w-28 h-28 flex-shrink-0">
        <div
          className="w-full h-full rounded-full"
          style={{ background: gradient }}
        />
        <div className="absolute inset-3 bg-content1 rounded-full flex flex-col items-center justify-center">
          <span className="text-sm font-bold text-foreground">
            {Math.round(total)}
            {unit ?? ""}
          </span>
          <span className="text-[8px] text-foreground/40 uppercase">/ día</span>
        </div>
      </div>
      <div className="flex-1 space-y-2.5">
        {legend.map((m) => (
          <div key={m.label}>
            <div className="flex items-center justify-between mb-0.5">
              <div className="flex items-center gap-1.5">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: m.color }}
                />
                <span className="text-xs font-medium text-foreground/70">
                  {m.label}
                </span>
              </div>
              <span className="text-xs font-bold text-foreground">
                {m.g}
                {unit ?? ""}{" "}
                <span className="text-foreground/40 font-normal">
                  ({m.pct}%)
                </span>
              </span>
            </div>
            <div className="h-1.5 bg-default-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${m.pct}%`,
                  backgroundColor: m.color,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
