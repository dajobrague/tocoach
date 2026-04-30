/**
 * Catalog adapters — the 14 predefined data sources.
 *
 * 12 of them are 1-D wrappers around form_responses (checkins or habits)
 * with an `analytics-keys.ts` resolver. We build those via the
 * `formResponse1D` factory to keep them DRY.
 *
 * 2 are multi-dim composites:
 *   - macros_breakdown (3 series: protein/carbs/fats, range_total only)
 *   - training_breakdown (2 series: strength/cardio, time-bucketed)
 *
 * Each adapter is also stable in the sense that `metadata.id` is what
 * gets stored in ChartConfig.source.id — never rename without a migration.
 */

import type { FormResponse } from "@/lib/forms/types";
import type {
  Aggregation,
  BucketedPoint,
  CatalogId,
  ChartDataSource,
  ColorToken,
  FormType,
} from "../types";
import type { AdapterContext, DataAdapter, ExerciseLogLike } from "./types";

import { averageInWindow, generateBuckets, sumInWindow } from "./bucketing";

import {
  resolveCaloriesAnswer,
  resolveCarbsAnswer,
  resolveFatsAnswer,
  resolveProteinAnswer,
  resolveSleepHoursAnswer,
  resolveStepsAnswer,
} from "@/lib/forms/analytics-keys";

// ─── Generic resolver (any answer key, finite-number coercion) ─────────────

function resolveByKey(keys: string[]) {
  return (r: FormResponse): number | null => {
    if (!r.answers) return null;
    for (const k of keys) {
      if (k in r.answers) {
        const raw = r.answers[k];

        if (raw === null || raw === undefined || raw === "") continue;
        const n = Number(raw);

        if (Number.isFinite(n)) return n;
      }
    }

    return null;
  };
}

// ─── Factory: 1-D adapter backed by form responses ─────────────────────────

interface FormResponse1DSpec {
  id: CatalogId;
  label: string;
  unit?: string;
  icon?: string;
  category: "checkin" | "habit";
  formType: FormType;
  resolve: (r: FormResponse) => number | null;
  default_chart_type: ChartDataSource["default_chart_type"];
  default_color: ColorToken;
}

function formResponse1D(spec: FormResponse1DSpec): DataAdapter {
  const metadata: ChartDataSource = {
    id: spec.id,
    label: spec.label,
    ...(spec.unit !== undefined ? { unit: spec.unit } : {}),
    ...(spec.icon !== undefined ? { icon: spec.icon } : {}),
    category: spec.category,
    dimensions: 1,
    default_chart_type: spec.default_chart_type,
    default_color: spec.default_color,
  };

  return {
    metadata,
    materialize(
      ctx: AdapterContext,
      aggregation: Aggregation
    ): BucketedPoint[] {
      const responses =
        spec.formType === "checkins"
          ? ctx.formResponses.checkins
          : ctx.formResponses.habits;
      const buckets = generateBuckets(ctx.range, aggregation, ctx.schedule);

      return buckets.map((w) => ({
        label: w.label,
        value: averageInWindow(responses, w, spec.resolve, ctx.schedule),
        periodTooltip: w.tooltip,
      }));
    },
  };
}

// ─── Catalog: 1-D adapters ─────────────────────────────────────────────────

const weight = formResponse1D({
  id: "weight",
  label: "Peso",
  unit: "kg",
  icon: "solar:body-bold",
  category: "checkin",
  formType: "checkins",
  resolve: resolveByKey(["weight", "peso", "weight_kg", "peso_kg"]),
  default_chart_type: "area",
  default_color: "weight-amber",
});

const bodyFat = formResponse1D({
  id: "body_fat",
  label: "Grasa corporal",
  unit: "%",
  icon: "solar:scale-bold",
  category: "checkin",
  formType: "checkins",
  resolve: resolveByKey([
    "body_fat",
    "grasa_corporal",
    "body_fat_pct",
    "bf_pct",
  ]),
  default_chart_type: "area",
  default_color: "neutral-slate",
});

const sleepHours = formResponse1D({
  id: "sleep_hours",
  label: "Sueño",
  unit: "h",
  icon: "solar:moon-sleep-bold",
  category: "habit",
  formType: "habits",
  resolve: (r) => resolveSleepHoursAnswer(r.answers),
  default_chart_type: "bar",
  default_color: "sleep-emerald",
});

const steps = formResponse1D({
  id: "steps",
  label: "Pasos",
  icon: "solar:walking-bold",
  category: "habit",
  formType: "habits",
  resolve: (r) => resolveStepsAnswer(r.answers),
  default_chart_type: "bar",
  default_color: "steps-cyan",
});

const calories = formResponse1D({
  id: "calories",
  label: "Calorías",
  unit: "kcal",
  icon: "solar:fire-bold",
  category: "habit",
  formType: "habits",
  resolve: (r) => resolveCaloriesAnswer(r.answers),
  default_chart_type: "bar",
  default_color: "calorie-coral",
});

const protein = formResponse1D({
  id: "protein",
  label: "Proteína",
  unit: "g",
  icon: "solar:health-bold",
  category: "habit",
  formType: "habits",
  resolve: (r) => resolveProteinAnswer(r.answers),
  default_chart_type: "area",
  default_color: "protein-indigo",
});

const carbs = formResponse1D({
  id: "carbs",
  label: "Carbohidratos",
  unit: "g",
  icon: "solar:bread-bold",
  category: "habit",
  formType: "habits",
  resolve: (r) => resolveCarbsAnswer(r.answers),
  default_chart_type: "area",
  default_color: "carbs-emerald-deep",
});

const fats = formResponse1D({
  id: "fats",
  label: "Grasas",
  unit: "g",
  icon: "solar:bottle-bold",
  category: "habit",
  formType: "habits",
  resolve: (r) => resolveFatsAnswer(r.answers),
  default_chart_type: "area",
  default_color: "fats-amber-deep",
});

const water = formResponse1D({
  id: "water",
  label: "Agua",
  unit: "L",
  icon: "solar:waterdrop-bold",
  category: "habit",
  formType: "habits",
  resolve: resolveByKey(["water", "agua", "water_liters", "litros_agua"]),
  default_chart_type: "bar",
  default_color: "water-sky",
});

const mood = formResponse1D({
  id: "mood",
  label: "Ánimo",
  icon: "solar:smile-circle-bold",
  category: "habit",
  formType: "habits",
  resolve: resolveByKey(["mood", "animo", "ánimo"]),
  default_chart_type: "line",
  default_color: "mood-violet",
});

const energy = formResponse1D({
  id: "energy",
  label: "Energía",
  icon: "solar:bolt-bold",
  category: "habit",
  formType: "habits",
  resolve: resolveByKey(["energy", "energia", "energía"]),
  default_chart_type: "line",
  default_color: "mood-violet",
});

const stress = formResponse1D({
  id: "stress",
  label: "Estrés",
  icon: "solar:shield-warning-bold",
  category: "habit",
  formType: "habits",
  resolve: resolveByKey(["stress", "estres", "estrés"]),
  default_chart_type: "line",
  default_color: "mood-violet",
});

// ─── Catalog: macros_breakdown (multi-dim, range_total) ────────────────────
//
// Replicates today's `avgMacros` calculation in dashboard-content.tsx:
// average per-day macros across days where the client reported AT LEAST ONE
// of the three macros. Days with no macro data are skipped (so an
// unreported day doesn't dilute the mean to 0).

const MACROS_SERIES = [
  {
    id: "protein",
    label: "Proteína",
    default_color: "protein-indigo" as const,
  },
  {
    id: "carbs",
    label: "Carbos",
    default_color: "carbs-emerald-deep" as const,
  },
  { id: "fats", label: "Grasas", default_color: "fats-amber-deep" as const },
] as const;

const macrosBreakdown: DataAdapter = {
  metadata: {
    id: "macros_breakdown",
    label: "Macros",
    icon: "solar:chart-2-bold",
    category: "habit",
    dimensions: "multi",
    series: MACROS_SERIES,
    default_chart_type: "ring",
    default_color: MACROS_SERIES.map((s) => s.default_color),
  },
  materialize(ctx, aggregation): BucketedPoint[] {
    // ring uses range_total only. If the caller passes anything else,
    // we still honor range_total to keep the ring renderable — the
    // validation layer should have prevented this.
    void aggregation;

    const fromMs = ctx.range.from.getTime();
    const toMs = ctx.range.to.getTime();

    type Triple = { p: number | null; c: number | null; f: number | null };
    const days: Triple[] = [];

    for (const r of ctx.formResponses.habits) {
      // Use submitted_at when present, else response_date noon UTC.
      const submitted = r.submitted_at
        ? new Date(r.submitted_at).getTime()
        : new Date(`${r.response_date}T12:00:00.000Z`).getTime();

      if (submitted < fromMs || submitted > toMs) continue;

      const t: Triple = {
        p: resolveProteinAnswer(r.answers),
        c: resolveCarbsAnswer(r.answers),
        f: resolveFatsAnswer(r.answers),
      };

      if (t.p !== null || t.c !== null || t.f !== null) days.push(t);
    }

    if (days.length === 0) {
      return [
        {
          label: "Total",
          value: { protein: null, carbs: null, fats: null },
        },
      ];
    }

    const sum = days.reduce<{ p: number; c: number; f: number }>(
      (acc, d) => ({
        p: acc.p + (d.p ?? 0),
        c: acc.c + (d.c ?? 0),
        f: acc.f + (d.f ?? 0),
      }),
      { p: 0, c: 0, f: 0 }
    );

    return [
      {
        label: "Total",
        value: {
          protein: Math.round(sum.p / days.length),
          carbs: Math.round(sum.c / days.length),
          fats: Math.round(sum.f / days.length),
        },
      },
    ];
  },
};

// ─── Catalog: training_breakdown (multi-dim, time-bucketed) ────────────────
//
// Replicates today's `trainingActivity` calculation: count strength vs
// cardio sessions per period. Uses scheduled_date for bucketing because
// that's what exercise_logs are keyed by today.

const TRAINING_SERIES = [
  { id: "strength", label: "Fuerza", default_color: "training-blue" as const },
  { id: "cardio", label: "Cardio", default_color: "cardio-rose" as const },
] as const;

const trainingBreakdown: DataAdapter = {
  metadata: {
    id: "training_breakdown",
    label: "Entrenamiento",
    icon: "solar:dumbbell-bold",
    category: "exercise",
    dimensions: "multi",
    series: TRAINING_SERIES,
    default_chart_type: "stacked_bar",
    default_color: TRAINING_SERIES.map((s) => s.default_color),
  },
  materialize(ctx, aggregation): BucketedPoint[] {
    const buckets = generateBuckets(ctx.range, aggregation, ctx.schedule);

    return buckets.map((w) => {
      const strength = sumInWindow<ExerciseLogLike>(
        ctx.exerciseLogs,
        w,
        (log) => log.exercises?.category !== "cardio",
        ctx.schedule
      );
      const cardio = sumInWindow<ExerciseLogLike>(
        ctx.exerciseLogs,
        w,
        (log) => log.exercises?.category === "cardio",
        ctx.schedule
      );

      return {
        label: w.label,
        value: { strength, cardio },
        periodTooltip: w.tooltip,
      };
    });
  },
};

// ─── Public registry table ─────────────────────────────────────────────────

/**
 * The 14 catalog adapters. Order is the display order in the picker.
 * Adding a new catalog adapter:
 *   1) Add the id to CatalogId in lib/charts/types.ts
 *   2) Add the id to catalogIdSchema in lib/charts/validation.ts
 *   3) Add the adapter here
 */
export const CATALOG_ADAPTERS: ReadonlyArray<DataAdapter> = [
  weight,
  bodyFat,
  sleepHours,
  steps,
  calories,
  protein,
  carbs,
  fats,
  water,
  mood,
  energy,
  stress,
  macrosBreakdown,
  trainingBreakdown,
];

/** Map for O(1) lookup by CatalogId. */
export const CATALOG_BY_ID: ReadonlyMap<CatalogId, DataAdapter> = new Map(
  CATALOG_ADAPTERS.map((a) => [a.metadata.id as CatalogId, a])
);
