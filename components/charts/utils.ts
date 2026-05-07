/**
 * Shared rendering helpers for the chart cards.
 *
 * These are pure functions used by every chart-type renderer:
 *   - xAxisInterval: how many tick labels to show given data length (mirrors
 *     today's progress-charts.tsx)
 *   - latestNonNull: pulls the most recent non-null value out of a 1-D
 *     bucket sequence — used for the card header's "current" value
 *   - formatNumber: ES-locale number formatting
 *   - iconForChartType: fallback icon when ChartConfig doesn't carry one
 */

import type { BucketedPoint, ChartType } from "@/lib/charts/types";

/**
 * Tick density that matches today's chart visuals. ≤8 buckets show every
 * label, 9-16 show every other, 17+ space out at ~8 labels.
 */
export function xAxisInterval(dataLen: number): number {
  if (dataLen <= 8) return 0;
  if (dataLen <= 16) return 1;

  return Math.floor(dataLen / 8);
}

/**
 * Returns the latest non-null numeric value from a 1-D bucket sequence,
 * or null if every bucket is null. Used by the card header "current value"
 * affordance.
 */
export function latestNonNull(buckets: BucketedPoint[]): number | null {
  for (let i = buckets.length - 1; i >= 0; i -= 1) {
    const v = buckets[i]?.value;

    if (typeof v === "number") return v;
  }

  return null;
}

/**
 * ES-locale number formatting. Doesn't add a unit suffix — the card
 * surrounds it with one explicitly.
 */
export function formatNumber(
  value: number | null | undefined,
  fractionDigits = 0
): string {
  if (value === null || value === undefined) return "—";

  return value.toLocaleString("es-ES", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

/**
 * Sum the values of a 1-D bucket sequence, ignoring nulls.
 */
export function sumNonNull(buckets: BucketedPoint[]): number {
  let s = 0;

  for (const b of buckets) {
    if (typeof b.value === "number") s += b.value;
  }

  return s;
}

/**
 * Average the values of a 1-D bucket sequence, ignoring nulls.
 */
export function avgNonNull(buckets: BucketedPoint[]): number | null {
  let s = 0;
  let n = 0;

  for (const b of buckets) {
    if (typeof b.value === "number") {
      s += b.value;
      n += 1;
    }
  }

  return n === 0 ? null : s / n;
}

/**
 * "No data" rule shared por el overlay de ChartCard y el agrupador
 * "Aún sin registrar" de ChartsSection. Array vacío, o todos los
 * buckets tienen value null/undefined.
 *
 * IMPORTANTE: 0 es un valor LEGÍTIMO (cliente registra 0 pasos, 0 horas
 * de sueño, día de descanso con 0 entrenamientos, etc.) — NO lo
 * tratamos como ausencia. La aggregation server-side ya emite null
 * explícito cuando no hay registros (averageInWindow devuelve null si
 * count===0; sumInWindow devuelve 0 solo cuando hay logs en el rango
 * pero ninguno aplica al filtro). Antes confundíamos esos dos casos y
 * los charts con valores cero legítimos terminaban en pendientes.
 *
 * Pass un array — undefined significa "loading" y el caller decide.
 */
export function isBucketsEmpty(buckets: BucketedPoint[]): boolean {
  if (buckets.length === 0) return true;

  return buckets.every((b) => {
    const v = b.value;

    if (v === null || v === undefined) return true;
    if (typeof v === "number") return false;
    if (typeof v === "object") {
      return Object.values(
        v as Record<string, number | null | undefined>
      ).every((sv) => sv === null || sv === undefined);
    }

    return false;
  });
}

/**
 * Generic fallback icon when the chart's data source has no `icon` set.
 * Form-question adapters land here.
 */
export function iconForChartType(chartType: ChartType): string {
  switch (chartType) {
    case "line":
      return "solar:chart-bold";
    case "area":
      return "solar:chart-bold";
    case "bar":
      return "solar:chart-square-bold";
    case "stacked_bar":
      return "solar:chart-square-bold";
    case "ring":
      return "solar:chart-2-bold";
    case "kpi":
      return "solar:hashtag-bold";
  }
}
