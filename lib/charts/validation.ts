/**
 * Zod schemas for the chart system.
 *
 * Two levels of validation:
 *   1. Structural — types, enums, ranges. Fully self-contained, runs on
 *      any input without needing the adapter registry. This is what the
 *      API routes use for the basic 422 path.
 *   2. Cross-field with adapter resolution — chart_type ↔ adapter.dimensions
 *      and color array length ↔ series count. These rules need the
 *      registry (lib/charts/registry.ts) which doesn't exist yet at the
 *      time this file is loaded. Use `validateChartConfigWithRegistry`
 *      from registry.ts for that pass — keeps this file dependency-free.
 *
 * Either pass returns ZodError with field paths so the API can surface
 * `{ "charts[2].chart_type": "ring requires multi-dim source" }`.
 */

import { z } from "zod";

import { COLOR_TOKENS } from "./palette";
import {
  AVERAGE_LINE_CHART_TYPES,
  TARGET_ZONE_CHART_TYPES,
  type ChartType,
} from "./types";

// ─── Primitive enums ────────────────────────────────────────────────────────

const colorTokenSchema = z.enum(
  COLOR_TOKENS as readonly [string, ...string[]] as readonly [
    (typeof COLOR_TOKENS)[number],
    ...(typeof COLOR_TOKENS)[number][],
  ]
);

const chartTypeSchema = z.enum([
  "line",
  "area",
  "bar",
  "stacked_bar",
  "ring",
  "kpi",
] as const);

const aggregationSchema = z.enum([
  "daily",
  "weekly",
  "checkin_period",
  "range_total",
] as const);

const formTypeSchema = z.enum(["checkins", "habits"] as const);

const catalogIdSchema = z.enum([
  "weight",
  "body_fat",
  "sleep_hours",
  "steps",
  "calories",
  "protein",
  "carbs",
  "fats",
  "water",
  "mood",
  "energy",
  "stress",
  "macros_breakdown",
  "training_breakdown",
] as const);

// ─── Composite primitives ──────────────────────────────────────────────────

const dataSourceRefSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("catalog"),
    id: catalogIdSchema,
  }),
  z.object({
    kind: z.literal("form_question"),
    form_type: formTypeSchema,
    question_id: z.string().min(1),
  }),
]);

const targetZoneSchema = z
  .object({
    min: z.number().finite(),
    max: z.number().finite(),
    margin: z.number().finite().min(0).optional(),
  })
  .refine((zone) => zone.min < zone.max, {
    message: "target_zone.min must be less than target_zone.max",
  })
  .refine(
    (zone) => zone.margin === undefined || zone.margin < zone.max - zone.min,
    { message: "target_zone.margin must be less than (max - min)" }
  );

// ─── Helpers ───────────────────────────────────────────────────────────────

const isMultiDim = (chartType: ChartType): boolean =>
  chartType === "ring" || chartType === "stacked_bar";

const allowsTargetZone = (chartType: ChartType): boolean =>
  (TARGET_ZONE_CHART_TYPES as readonly string[]).includes(chartType);

const allowsAverageLine = (chartType: ChartType): boolean =>
  (AVERAGE_LINE_CHART_TYPES as readonly string[]).includes(chartType);

// ─── ChartConfig schema (structural; no adapter resolution) ────────────────

/**
 * Validates a ChartConfig WITHOUT resolving the source against the adapter
 * registry. This catches:
 *   - bad enums
 *   - target_zone / show_average_line on incompatible chart types
 *   - color array vs single token consistent with chart-type dimensionality
 *   - ring requires range_total aggregation
 *   - form_question source cannot back ring/stacked_bar (since form
 *     questions are always 1-D)
 *
 * It does NOT catch a catalog id whose registered adapter happens to be 1-D
 * but the chart_type is multi-dim (or vice versa). Use the second pass in
 * registry.ts for that.
 */
export const chartConfigSchema = z
  .object({
    id: z.string().uuid(),
    position: z.number().int().min(0),
    label: z.string().min(1).max(60),
    source: dataSourceRefSchema,
    chart_type: chartTypeSchema,
    color: z.union([colorTokenSchema, z.array(colorTokenSchema).min(1)]),
    target_zone: targetZoneSchema.optional(),
    aggregation: aggregationSchema,
    show_average_line: z.boolean().optional(),
  })
  .superRefine((cfg, ctx) => {
    const multiDim = isMultiDim(cfg.chart_type);

    // color shape ↔ chart-type dimensionality
    if (multiDim && !Array.isArray(cfg.color)) {
      ctx.addIssue({
        code: "custom",
        path: ["color"],
        message: `${cfg.chart_type} requires a color array`,
      });
    }
    if (!multiDim && Array.isArray(cfg.color)) {
      ctx.addIssue({
        code: "custom",
        path: ["color"],
        message: `${cfg.chart_type} requires a single color token, not an array`,
      });
    }

    // target_zone only on line / area / bar
    if (cfg.target_zone && !allowsTargetZone(cfg.chart_type)) {
      ctx.addIssue({
        code: "custom",
        path: ["target_zone"],
        message: `target_zone is not allowed on ${cfg.chart_type}`,
      });
    }

    // show_average_line only on line / area / bar
    if (cfg.show_average_line && !allowsAverageLine(cfg.chart_type)) {
      ctx.addIssue({
        code: "custom",
        path: ["show_average_line"],
        message: `show_average_line is not allowed on ${cfg.chart_type}`,
      });
    }

    // ring REQUIRES range_total
    if (cfg.chart_type === "ring" && cfg.aggregation !== "range_total") {
      ctx.addIssue({
        code: "custom",
        path: ["aggregation"],
        message: "ring charts require aggregation = range_total",
      });
    }

    // range_total only on ring or kpi
    if (
      cfg.aggregation === "range_total" &&
      cfg.chart_type !== "ring" &&
      cfg.chart_type !== "kpi"
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["aggregation"],
        message: `aggregation = range_total is only allowed on ring or kpi (got ${cfg.chart_type})`,
      });
    }

    // form_question sources are 1-D — reject if used with multi-dim chart
    if (cfg.source.kind === "form_question" && multiDim) {
      ctx.addIssue({
        code: "custom",
        path: ["chart_type"],
        message: `${cfg.chart_type} cannot be backed by a form_question source (form questions are 1-D)`,
      });
    }
  });

export type ChartConfigInput = z.infer<typeof chartConfigSchema>;

// ─── Document schema ───────────────────────────────────────────────────────

/**
 * A full charts document. Validates the version pin, deduplicates ids,
 * and confirms that `position` matches array order (the array is the
 * canonical source of truth for ordering — `position` is materialized).
 */
export const chartsDocumentSchema = z
  .object({
    version: z.literal(1),
    charts: z.array(chartConfigSchema).max(50),
  })
  .superRefine((doc, ctx) => {
    const seenIds = new Set<string>();

    doc.charts.forEach((c, i) => {
      if (seenIds.has(c.id)) {
        ctx.addIssue({
          code: "custom",
          path: ["charts", i, "id"],
          message: "duplicate chart id within document",
        });
      } else {
        seenIds.add(c.id);
      }
      if (c.position !== i) {
        ctx.addIssue({
          code: "custom",
          path: ["charts", i, "position"],
          message: `position ${c.position} does not match array index ${i}`,
        });
      }
    });
  });

export type ChartsDocumentInput = z.infer<typeof chartsDocumentSchema>;

// ─── Convenience ───────────────────────────────────────────────────────────

/**
 * Re-export the inferred type so call sites that have already validated
 * can lean on the validated shape. Distinct from `ChartConfig` in
 * lib/charts/types.ts in that the inferred type is structurally what
 * passed validation — for runtime correctness, treat the two as
 * interchangeable as long as you only assign already-validated values.
 */
export type ValidatedChartConfig = ChartConfigInput;
export type ValidatedChartsDocument = ChartsDocumentInput;
