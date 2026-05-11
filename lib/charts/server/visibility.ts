/**
 * Audience-based chart filtering.
 *
 * Charts can carry a `visibility` flag of `"trainer_only"` so the trainer
 * can track a metric per-client without exposing it on the client-facing
 * dashboard. The filter runs server-side BEFORE any chart configuration
 * leaves the API, so a malicious client can't extract trainer-only chart
 * ids by inspecting network traffic or guessing query params.
 *
 * Default: charts without `visibility` are treated as `"shared"` so every
 * chart stored before this field existed keeps its existing behavior.
 *
 * Used by:
 *   - GET /api/charts/clients/[clientId]/snapshot
 *   - GET /api/charts/clients/[clientId]
 *
 * The PUT/DELETE versions of those endpoints are `trainerOnly: true`, so
 * they don't need filtering — only trainers can mutate.
 */

import type { ChartConfig, ChartsDocument } from "../types";

import { EMPTY_CHARTS_DOCUMENT } from "../types";

/**
 * Whether the chart should be visible to the given audience. `undefined`
 * visibility is treated as `"shared"`.
 */
function isVisibleTo(
  chart: ChartConfig,
  audience: "trainer" | "client"
): boolean {
  if (audience === "trainer") return true;

  // client audience
  return chart.visibility !== "trainer_only";
}

/**
 * Return a new ChartsDocument with charts the audience can see, in their
 * original order but with `position` renumbered to match the new index so
 * the array stays self-consistent (the validator enforces
 * `position === index`).
 *
 * If nothing is filtered, the original reference is returned to avoid
 * allocating in the common case.
 */
export function filterChartsForAudience(
  doc: ChartsDocument,
  audience: "trainer" | "client"
): ChartsDocument {
  if (audience === "trainer") return doc;
  const visible = doc.charts.filter((c) => isVisibleTo(c, audience));

  if (visible.length === doc.charts.length) return doc;
  if (visible.length === 0) return { ...EMPTY_CHARTS_DOCUMENT };

  return {
    ...doc,
    charts: visible.map((c, i) => ({ ...c, position: i })),
  };
}
