/**
 * Header-stat selection for the chart cards.
 *
 * El número grande de la card puede mostrar la media del rango visible
 * o el último valor registrado — el espectador elige con un toggle
 * (feedback cliente ago-2026: el número sin etiqueta se leía como
 * "media" siendo el último valor). La media usa avgNonNull, el mismo
 * cálculo que la línea punteada, así número y línea siempre coinciden.
 *
 * Default = "average" (feedback JC sep-2026: la media es lo que se
 * consulta a diario; el último valor es para consultas puntuales).
 */

import type { BucketedPoint } from "@/lib/charts/types";

import { avgNonNull, latestNonNull } from "./utils";

export type HeaderStatMode = "latest" | "average";

export const DEFAULT_HEADER_STAT: HeaderStatMode = "average";

export function headerStatValue(
  buckets: BucketedPoint[],
  mode: HeaderStatMode
): number | null {
  return mode === "average" ? avgNonNull(buckets) : latestNonNull(buckets);
}

/**
 * Guard para el valor crudo de localStorage — cualquier cosa que no sea
 * un modo válido degrada al default.
 */
export function parseHeaderStatMode(raw: string | null): HeaderStatMode {
  return raw === "latest" ? "latest" : DEFAULT_HEADER_STAT;
}
