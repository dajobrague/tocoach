/**
 * Color palette for charts.
 *
 * Tokens are stored in ChartConfig.color (in the JSONB document) — never
 * raw hex. This lets us re-skin the palette later without touching stored
 * data. Each token resolves to a `{ stroke, fill, soft }` triple at render
 * time:
 *
 *   stroke — the line/border color (solid; 100% opacity)
 *   fill   — the area gradient base or bar fill (used at ~60% alpha typically)
 *   soft   — a softer tint for secondary affordances (icon backgrounds,
 *            target-zone overlays). Roughly 12-15% alpha equivalent.
 *
 * AA contrast verified against light (#ffffff) and dark (#0b0b0b) page
 * backgrounds for `stroke`. `fill` and `soft` are not contrast-critical
 * because they back values, not text.
 */

import type { ColorToken } from "./types";

export interface ResolvedColor {
  stroke: string;
  fill: string;
  soft: string;
}

/**
 * The 12 curated tokens. Hex values intentionally inline — the resolver is
 * the single source of truth and is small enough that tooling-level
 * theming would just swap this object.
 */
const PALETTE: Record<ColorToken, ResolvedColor> = {
  "weight-amber": {
    stroke: "#f59e0b",
    fill: "#f59e0b",
    soft: "rgba(245, 158, 11, 0.12)",
  },
  "sleep-emerald": {
    stroke: "#10b981",
    fill: "#34d399",
    soft: "rgba(52, 211, 153, 0.14)",
  },
  "calorie-coral": {
    stroke: "#ef4444",
    fill: "#ef4444",
    soft: "rgba(239, 68, 68, 0.12)",
  },
  "protein-indigo": {
    stroke: "#6366f1",
    fill: "#6366f1",
    soft: "rgba(99, 102, 241, 0.12)",
  },
  "carbs-emerald-deep": {
    stroke: "#059669",
    fill: "#10b981",
    soft: "rgba(16, 185, 129, 0.14)",
  },
  "fats-amber-deep": {
    stroke: "#d97706",
    fill: "#f59e0b",
    soft: "rgba(245, 158, 11, 0.14)",
  },
  "mood-violet": {
    stroke: "#a78bfa",
    fill: "#a78bfa",
    soft: "rgba(167, 139, 250, 0.14)",
  },
  "steps-cyan": {
    stroke: "#22d3ee",
    fill: "#22d3ee",
    soft: "rgba(34, 211, 238, 0.14)",
  },
  "water-sky": {
    stroke: "#0ea5e9",
    fill: "#38bdf8",
    soft: "rgba(56, 189, 248, 0.14)",
  },
  "training-blue": {
    stroke: "#3b82f6",
    fill: "#3b82f6",
    soft: "rgba(59, 130, 246, 0.14)",
  },
  "cardio-rose": {
    stroke: "#f43f5e",
    fill: "#f43f5e",
    soft: "rgba(244, 63, 94, 0.14)",
  },
  "neutral-slate": {
    stroke: "#64748b",
    fill: "#94a3b8",
    soft: "rgba(148, 163, 184, 0.14)",
  },
};

/**
 * Ordered list of tokens for UI pickers. Order is intentional — palette
 * pickers should display in this order so frequent tokens (weight, sleep,
 * etc.) appear first.
 */
export const COLOR_TOKENS: readonly ColorToken[] = [
  "weight-amber",
  "sleep-emerald",
  "calorie-coral",
  "protein-indigo",
  "carbs-emerald-deep",
  "fats-amber-deep",
  "mood-violet",
  "steps-cyan",
  "water-sky",
  "training-blue",
  "cardio-rose",
  "neutral-slate",
] as const;

/**
 * Resolve a color token to its hex/rgba triple. Throws on unknown token —
 * if you reach this with an unknown value, the JSONB validator failed
 * upstream; that's a bug to surface, not silently absorb.
 */
export function resolveColor(token: ColorToken): ResolvedColor {
  const resolved = PALETTE[token];

  if (!resolved) {
    throw new Error(`[charts] Unknown color token: ${token}`);
  }

  return resolved;
}

/**
 * Special-cased palette for target-zone bar coloring. Returns the bar fill
 * for a given value relative to the zone. The yellow band is only rendered
 * when `margin > 0`.
 *
 * Rules (where m = zone.margin ?? 0):
 *   value < min - m     => red    (#fca5a5)
 *   min - m ≤ v < min   => yellow (#fde68a) — only if m > 0
 *   min ≤ v ≤ max       => green  (#34d399)
 *   v > max             => light  (#6ee7b7)
 *
 * Used by the bar renderer when ChartConfig.target_zone is set.
 */
export function resolveTargetZoneFill(
  value: number,
  zone: { min: number; max: number; margin?: number }
): string {
  const m = zone.margin ?? 0;

  if (value < zone.min - m) return "#fca5a5"; // red
  if (m > 0 && value < zone.min) return "#fde68a"; // yellow
  if (value <= zone.max) return "#34d399"; // green

  return "#6ee7b7"; // light green (above target)
}
