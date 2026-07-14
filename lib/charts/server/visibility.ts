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
 * Resolve the DISPLAY AUDIENCE for a client-facing charts route, decoupled
 * from the authenticated actor.
 *
 * Both the snapshot and the per-client GET endpoint are hit by two callers:
 *   - the CLIENT portal (charts-section.tsx via clientFetch), and
 *   - the TRAINER's own preview/edit surface (lib/charts/hooks.ts).
 * The `trainer-session` and `client-session` cookies coexist in one browser,
 * so a trainer cookie can be attached to a client-portal request. If we keyed
 * the audience off `auth.actor.kind` (which prioritises the trainer session),
 * a trainer-cookied browser viewing the client portal would receive the
 * UNFILTERED doc — leaking `trainer_only` charts into the client view.
 *
 * So the client-facing view defaults to the CLIENT audience. The unfiltered
 * TRAINER view is served ONLY when the request is from a genuine trainer
 * (`actorKind === "trainer"`, i.e. a valid trainer session that owns the
 * client) AND explicitly opts in via `?as=trainer`. The client portal never
 * sends that param, and a client session can never satisfy the actor check
 * (its actorKind is "client"), so a client can't forge the trainer view.
 */
export function resolveAudience(
  actorKind: "trainer" | "client",
  searchParams: URLSearchParams
): "trainer" | "client" {
  if (actorKind === "trainer" && searchParams.get("as") === "trainer") {
    return "trainer";
  }

  return "client";
}

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
