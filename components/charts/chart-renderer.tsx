/**
 * <ChartRenderer>
 *
 * Pure presentational dispatcher: takes a ChartConfig + the bucketed
 * data and picks the right specific renderer. Doesn't fetch, doesn't
 * decide loading / empty / error states — that's <ChartCard>'s job.
 *
 * Multi-dim renderers (stacked_bar, ring) read `series` from the resolved
 * adapter; we accept it as a prop so the renderer doesn't need a registry
 * round-trip.
 */

"use client";

import type {
  BucketedPoint,
  ChartConfig,
  ColorToken,
} from "@/lib/charts/types";

import { BarRenderer } from "./renderers/bar";
import { KpiRenderer } from "./renderers/kpi";
import { LineAreaRenderer } from "./renderers/line-area";
import { RingRenderer } from "./renderers/ring";
import { StackedBarRenderer } from "./renderers/stacked-bar";

interface Props {
  config: ChartConfig;
  buckets: BucketedPoint[];
  /** Required for stacked_bar and ring; ignored for 1-D charts. */
  series?: ReadonlyArray<{ id: string; label: string }>;
  /** Optional fixed Y-axis ceiling; comes from the resolved adapter. */
  yMax?: number;
}

export function ChartRenderer({ config, buckets, series, yMax }: Props) {
  switch (config.chart_type) {
    case "line":
    case "area": {
      const color = config.color as ColorToken;

      return (
        <LineAreaRenderer
          buckets={buckets}
          color={color}
          gradientId={`grad-${config.id}`}
          {...(config.show_average_line !== undefined
            ? { showAverageLine: config.show_average_line }
            : {})}
          {...(config.target_zone !== undefined
            ? { targetZone: config.target_zone }
            : {})}
          {...(yMax !== undefined ? { yMax } : {})}
          variant={config.chart_type}
        />
      );
    }
    case "bar": {
      const color = config.color as ColorToken;

      return (
        <BarRenderer
          buckets={buckets}
          color={color}
          {...(config.show_average_line !== undefined
            ? { showAverageLine: config.show_average_line }
            : {})}
          {...(config.target_zone !== undefined
            ? { targetZone: config.target_zone }
            : {})}
          {...(yMax !== undefined ? { yMax } : {})}
        />
      );
    }
    case "stacked_bar": {
      const colors = config.color as ColorToken[];

      return (
        <StackedBarRenderer
          buckets={buckets}
          colors={colors}
          series={series ?? []}
        />
      );
    }
    case "ring": {
      const colors = config.color as ColorToken[];

      return (
        <RingRenderer buckets={buckets} colors={colors} series={series ?? []} />
      );
    }
    case "kpi": {
      const color = config.color as ColorToken;

      return <KpiRenderer buckets={buckets} color={color} />;
    }
  }
}
