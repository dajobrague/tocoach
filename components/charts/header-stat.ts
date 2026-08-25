/**
 * Header-stat selection for the chart cards.
 *
 * El número grande de la card puede mostrar el último valor registrado
 * o la media del rango visible — el espectador elige con un toggle
 * (feedback cliente ago-2026: el número sin etiqueta se leía como
 * "media" siendo el último valor). La media usa avgNonNull, el mismo
 * cálculo que la línea punteada, así número y línea siempre coinciden.
 */

import type { BucketedPoint } from "@/lib/charts/types";

import { avgNonNull, latestNonNull } from "./utils";

export type HeaderStatMode = "latest" | "average";

export function headerStatValue(
  buckets: BucketedPoint[],
  mode: HeaderStatMode
): number | null {
  return mode === "average" ? avgNonNull(buckets) : latestNonNull(buckets);
}

/**
 * Guard para el valor crudo de localStorage — cualquier cosa que no sea
 * un modo válido degrada a "latest" (el comportamiento histórico).
 */
export function parseHeaderStatMode(raw: string | null): HeaderStatMode {
  return raw === "average" ? "average" : "latest";
}
