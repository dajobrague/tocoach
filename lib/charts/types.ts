/**
 * Custom Charting System — type definitions.
 *
 * The shape stored in trainer_chart_templates.charts and
 * client_chart_configs.charts is a `ChartsDocument`. The reader validates
 * `version` on read; unknown versions fall through to a no-op renderer.
 *
 * Validation logic lives in lib/charts/validation.ts. This file is types
 * only — keep it free of zod imports so it can be consumed from server,
 * client, and edge code without dragging the validator in.
 */

// ─── Color palette tokens ───────────────────────────────────────────────────

/** Named tokens; resolved to hex at render time via lib/charts/palette.ts. */
export type ColorToken =
  | "weight-amber"
  | "sleep-emerald"
  | "calorie-coral"
  | "protein-indigo"
  | "carbs-emerald-deep"
  | "fats-amber-deep"
  | "mood-violet"
  | "steps-cyan"
  | "water-sky"
  | "training-blue"
  | "cardio-rose"
  | "neutral-slate";

// ─── Chart type vocabulary ─────────────────────────────────────────────────

export type ChartType =
  | "line"
  | "area"
  | "bar"
  | "stacked_bar"
  | "ring"
  | "kpi";

/** Chart types that are 1-D. */
export const SINGLE_DIM_CHART_TYPES = [
  "line",
  "area",
  "bar",
  "kpi",
] as const satisfies readonly ChartType[];

/** Chart types that are multi-series. */
export const MULTI_DIM_CHART_TYPES = [
  "stacked_bar",
  "ring",
] as const satisfies readonly ChartType[];

/** Chart types where target_zone is meaningful (line/area/bar). */
export const TARGET_ZONE_CHART_TYPES = [
  "line",
  "area",
  "bar",
] as const satisfies readonly ChartType[];

/** Chart types where show_average_line is meaningful. */
export const AVERAGE_LINE_CHART_TYPES = TARGET_ZONE_CHART_TYPES;

// ─── Aggregation ───────────────────────────────────────────────────────────

/**
 * How data points are bucketed inside the dashboard's selected range.
 * - daily: one bucket per day
 * - weekly: one bucket per ISO week (Mon-Sun)
 * - biweekly: one bucket per 2 weeks (anchored al mismo lunes que weekly).
 *   Usado por el override de 6m para mantener ~13 buckets cómodos en
 *   mobile sin caer en monthly que se siente demasiado coarse.
 * - checkin_period: bucketed by the trainer's check-in schedule (e.g.
 *   weekly Mon-Sun, biweekly, etc.) — uses CheckInSchedule from lib/forms.
 * - range_total: a single value for the whole range. Required for `ring`
 *   (which is non-temporal) and allowed for `kpi`.
 */
export type Aggregation =
  | "daily"
  | "weekly"
  | "biweekly"
  | "monthly"
  | "checkin_period"
  | "range_total";

// ─── Data sources ──────────────────────────────────────────────────────────

/**
 * IDs of catalog data sources. These are predefined in code and stable —
 * renaming one is a breaking change to stored ChartConfig rows. New
 * catalog ids only ever get added, never renamed.
 *
 * Multi-dim catalog sources (macros_breakdown, training_breakdown) are
 * marked in the adapter implementation; consumers use the `dimensions`
 * field of the resolved adapter, not this list.
 */
export type CatalogId =
  | "weight"
  | "body_fat"
  | "sleep_hours"
  | "steps"
  | "calories"
  | "protein"
  | "carbs"
  | "fats"
  | "water"
  | "mood"
  | "energy"
  | "stress"
  | "macros_breakdown"
  | "training_breakdown";

export type FormType = "checkins" | "habits";

export type DataSourceRef =
  | { kind: "catalog"; id: CatalogId }
  | { kind: "form_question"; form_type: FormType; question_id: string };

// ─── Target zone ───────────────────────────────────────────────────────────

export interface TargetZone {
  min: number;
  max: number;
  /**
   * Optional yellow-band width below `min`. When > 0, values in
   * [min - margin, min) render yellow (warning) instead of red. The
   * default-seeded SUEÑO chart uses margin=1 to preserve today's
   * red/yellow/green/light-green color scheme.
   */
  margin?: number;
}

// ─── Chart config ──────────────────────────────────────────────────────────

export interface ChartConfig {
  /** uuid; stable React key, survives reorders. */
  id: string;
  /** 0-based; canonical for ordering. Array order is also canonical and must match. */
  position: number;
  /** User-facing label, e.g. "PESO". */
  label: string;
  source: DataSourceRef;
  chart_type: ChartType;
  /**
   * Single token for 1-D sources. Array of tokens for multi-dim sources;
   * length must equal the resolved adapter's series count.
   */
  color: ColorToken | ColorToken[];
  /** Allowed only when chart_type ∈ {line, area, bar}. */
  target_zone?: TargetZone;
  aggregation: Aggregation;
  /** Allowed only when chart_type ∈ {line, area, bar}. */
  show_average_line?: boolean;
  /**
   * Trainer-chosen Iconify id (e.g. "solar:body-bold"). When set, takes
   * precedence over the adapter's metadata.icon at render time. Lets the
   * trainer pick an icon for charts whose source adapter has no default
   * (form_question) or override the catalog adapter's default.
   */
  icon?: string;
  /**
   * Who can see this chart on the client's dashboard.
   * - "shared" (or undefined): the chart appears on both the trainer's
   *   view of the client AND the client's own dashboard.
   * - "trainer_only": the chart appears ONLY on the trainer's view —
   *   filtered out server-side from any response served to a client
   *   session. Lets trainers track per-client metrics they don't want
   *   the client to see (internal notes, adherence flags, etc.).
   *
   * `undefined` is treated as "shared" so every chart stored before this
   * field existed keeps its existing behavior.
   */
  visibility?: "shared" | "trainer_only";
}

export interface ChartsDocument {
  version: 1;
  charts: ChartConfig[];
}

/** Helper: empty document for new templates. */
export const EMPTY_CHARTS_DOCUMENT: ChartsDocument = {
  version: 1,
  charts: [],
};

// ─── Adapter contract ──────────────────────────────────────────────────────

export interface DateRange {
  from: Date;
  to: Date;
}

/** Single-series data point. */
export interface DataPoint {
  /** YMD or ISO datetime depending on aggregation; opaque to renderer. */
  ts: string;
  /** Raw numeric value, or null when the client didn't report. */
  value: number | null;
}

/** Multi-series data point (one entry per series id). */
export interface MultiSeriesPoint {
  ts: string;
  values: Record<string, number | null>;
}

/** Bucketed point ready for rendering. */
export interface BucketedPoint {
  /** Display label, e.g. "L 28" or "May 4". */
  label: string;
  /** Either a single value (1-D) or a dictionary of series_id -> value. */
  value: number | null | Record<string, number | null>;
  /** Tooltip prefix line, e.g. "1 abr — 7 abr". Optional. */
  periodTooltip?: string;
}

/**
 * The contract every data source must satisfy. See lib/charts/adapters/*
 * for implementations.
 */
export interface ChartDataSource {
  /** Stable id, e.g. "weight" or "form_q:<uuid>". */
  id: string;
  /** ES-localized label shown in the picker and chart card. */
  label: string;
  /** Optional unit suffix shown next to values. */
  unit?: string;
  /** Grouping for the data-source picker. */
  category: "checkin" | "habit" | "exercise" | "neat";
  /**
   * Optional iconify id (e.g. "solar:body-bold") used by the chart card
   * header. When absent, the renderer derives a generic icon from
   * chart_type. Catalog adapters set this to preserve today's per-metric
   * icons; the form-question adapter omits it.
   */
  icon?: string;
  /**
   * Optional fixed upper bound on the Y-axis. Set on rating-type sources
   * (mood / energy / stress) so Recharts doesn't auto-scale to 10.5 when
   * a data point hits 10. Renderers respect this for line / area / bar.
   */
  y_max?: number;
  /** 1-D vs multi-series. Drives chart-type validation. */
  dimensions: 1 | "multi";
  /**
   * For multi-dim sources: the ordered series (must align with `color` array
   * length on multi-dim ChartConfig). Undefined for 1-D sources.
   */
  series?: ReadonlyArray<{
    id: string;
    label: string;
    default_color: ColorToken;
  }>;
  default_chart_type: ChartType;
  default_color: ColorToken | ColorToken[];
}

/**
 * Save-state machine for the per-chart status pill in the editor surface.
 * The UI never shows "saving" longer than the autosave debounce window.
 */
export type ChartSaveState = "idle" | "saving" | "saved" | "error";
