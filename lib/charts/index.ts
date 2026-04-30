/**
 * Public surface for the lib/charts module.
 *
 * Hosts the feature flag `USE_NEW_CHART_SYSTEM` that gates the client
 * dashboard's chart rendering between the new generic ChartSurface and
 * the legacy bespoke charts in components/client-dashboard/progress-charts.tsx.
 *
 * Default is enabled. To roll back without a code revert:
 *   NEXT_PUBLIC_USE_NEW_CHART_SYSTEM=false   # set in env, restart server
 *
 * The legacy chart code stays in tree behind this flag for ~2 weeks of
 * clean telemetry. A follow-up PR removes both the flag and the legacy
 * chart components once we're confident in the new path.
 */

export const USE_NEW_CHART_SYSTEM =
  process.env.NEXT_PUBLIC_USE_NEW_CHART_SYSTEM !== "false";
