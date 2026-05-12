/**
 * KPI tile — a single big-number renderer with optional delta vs previous
 * period.
 *
 * 1-D only. With aggregation = range_total → one bucket; the value IS the
 * KPI. With time-bucketed aggregations → KPI is the latest non-null value
 * and the delta is computed against the prior bucket.
 */

"use client";

import type { BucketedPoint, ColorToken } from "@/lib/charts/types";

import { formatNumber } from "../utils";

import { resolveColor } from "@/lib/charts/palette";

interface Props {
  buckets: BucketedPoint[];
  color: ColorToken;
  unit?: string;
}

export function KpiRenderer({ buckets, color, unit }: Props) {
  const palette = resolveColor(color);

  // Latest non-null and previous-non-null (in time-bucketed mode).
  let current: number | null = null;
  let previous: number | null = null;

  for (let i = buckets.length - 1; i >= 0; i -= 1) {
    const v = buckets[i]?.value;

    if (typeof v === "number") {
      if (current === null) current = v;
      else if (previous === null) {
        previous = v;
        break;
      }
    }
  }

  const delta =
    current !== null && previous !== null && previous !== 0
      ? ((current - previous) / Math.abs(previous)) * 100
      : null;

  if (current === null) {
    return (
      <div className="flex items-center justify-center h-32">
        <span className="text-3xl text-foreground/20">—</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start justify-center h-32">
      <p
        className="text-5xl font-bold tabular-nums"
        style={{ color: palette.stroke }}
      >
        {formatNumber(current, current >= 100 ? 0 : 1)}
        {unit ? (
          <span className="text-2xl text-foreground/50 ml-1 font-medium">
            {unit}
          </span>
        ) : null}
      </p>
      {delta !== null ? (
        <p
          className={`text-xs font-medium mt-2 ${
            delta >= 0 ? "text-emerald-600" : "text-rose-600"
          }`}
        >
          {delta >= 0 ? "↑" : "↓"} {formatNumber(Math.abs(delta), 1)}% vs
          periodo anterior
        </p>
      ) : null}
    </div>
  );
}
