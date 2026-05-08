/**
 * Decisión de aggregation efectiva por rango.
 *
 * El cliente del dashboard puede elegir entre 5 rangos (7d / 30d / 3m
 * / 6m / 12m). Para cada rango el sistema decide la granularidad que
 * mejor se ve en mobile (ver `getEffectiveAggregation`). La
 * `chart.aggregation` que el trainer guarda funciona como FALLBACK —
 * solo se usa cuando el rango no impone un override.
 *
 * Este módulo está extraído del snapshot route para que el lado
 * trainer (preview de plantilla con demo data en `chart-surface.tsx`)
 * pueda aplicar EXACTAMENTE la misma lógica que el server, y así el
 * trainer ve "lo que su cliente verá" sin desfases.
 */

import type { Aggregation, ChartType } from "./types";

/**
 * Decide la `aggregation` efectiva del chart según el rango que el
 * cliente seleccionó en el dashboard. La `chart.aggregation` guardada
 * por el trainer funciona como FALLBACK — solo se usa cuando el
 * rango no impone un override.
 *
 * Por qué existe este override:
 *   El trainer típicamente configura cada chart con un `aggregation`
 *   pensado para un rango "típico" (e.g. weekly check-in periods). El
 *   cliente puede mirar 7d / 30d / 3m / 6m / 12m. Si forzamos siempre
 *   la aggregation del trainer, el 7d puede mostrar 1 solo bucket
 *   (poco informativo) y el 12m puede explotar a 365 puntos
 *   (ilegible).
 *
 *   Para cada rango elegimos la granularidad que maximiza información
 *   sin saturar la pantalla, manteniendo ~13 buckets visibles cuando
 *   posible para que la densidad visual sea consistente al cambiar de
 *   tab.
 *
 * Tabla de overrides:
 *   - 7d  → daily       (7 buckets)
 *   - 30d → daily       (30 buckets, bars finas pero legibles)
 *   - 3m / 90d → weekly (~13 buckets)
 *   - 6m  → biweekly    (~13 buckets)
 *   - 12m → monthly     (12 buckets)
 *
 * Guards defensivos por chart_type:
 *   - `range_total` (típicamente ring, o un KPI deliberado de
 *     "promedio del periodo") está pensado para 1 solo bucket. No se
 *     fragmenta en buckets diarios — perdería su semántica.
 *   - `stacked_bar` (training breakdown apilado): 30 stacked bars en
 *     mobile (~310px) son ~10px cada una con 2 segmentos verticales
 *     — visualmente saturado. Mantenemos la elección del trainer.
 */
export function getEffectiveAggregation(
  rangeKey: string,
  fallback: Aggregation,
  chartType: ChartType
): Aggregation {
  if (fallback === "range_total") return "range_total";
  if (chartType === "stacked_bar") return fallback;

  if (rangeKey === "7d") return "daily";
  if (rangeKey === "30d") return "daily";
  // "3m" (cliente) y "90d" (trainer-side ChartRange) son sinónimos —
  // ambos mapean a 90 días en RANGE_DAYS y deben recibir el mismo
  // tratamiento para que la preview del trainer match con lo que ve
  // el cliente.
  if (rangeKey === "3m" || rangeKey === "90d") return "weekly";
  if (rangeKey === "6m") return "biweekly";
  if (rangeKey === "12m") return "monthly";

  return fallback;
}
