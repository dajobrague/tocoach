/**
 * Catalog adapters — fuentes especiales que NO se pueden expresar como
 * form_question puro.
 *
 * Post-migration 102 (2026-05-12) los 11 adapters 1-D que envolvían
 * form_responses con un resolver heurístico (sleep_hours, steps,
 * calories, protein, carbs, fats, water, mood, energy, stress,
 * body_fat) se RETIRARON: las charts que apuntaban a ellos fueron
 * reescritas a form_question/<form_type>/<question_id> apuntando a la
 * pregunta concreta del template del trainer. La forma "personalización
 * absoluta" reemplazó el matching por nombre con un binding directo.
 *
 * Los 2 adapters que quedan son composites multi-dim sin equivalente
 * form_question:
 *   - macros_breakdown (3 series: protein/carbs/fats, ring/range_total)
 *   - training_breakdown (2 series: strength/cardio, lee exercise_logs)
 *
 * Charts huérfanos en producción que aún apuntan a uno de los 11 ids
 * retirados (porque su tenant nunca tuvo la pregunta compatible) se
 * filtran en runtime por `filterUnusableCharts` — el adapter no
 * resuelve y el chart no se renderea.
 *
 * `metadata.id` es lo que se serializa en ChartConfig.source.id — NUNCA
 * renombrar sin un shim.
 */

import type { BucketedPoint } from "../types";
import type { DataAdapter, ExerciseLogLike } from "./types";

import { generateBuckets, sumInWindow } from "./bucketing";

import {
  resolveCarbsAnswer,
  resolveFatsAnswer,
  resolveProteinAnswer,
} from "@/lib/forms/analytics-keys";

// ─── Catalog: macros_breakdown (multi-dim, range_total) ────────────────────
//
// Promedio diario de macros entre días donde el cliente reportó AL MENOS
// uno de los tres. Días sin datos se skipean (un día sin registro no
// diluye la media a 0).

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

    // Comparamos contra response_date (string YYYY-MM-DD) en lugar de
    // submitted_at ms. El SQL pre-filter usa response_date; mezclar ms
    // de submitted_at acá dropeaba rows submitidas cerca de medianoche
    // local en husos no-UTC.
    const ymd = (d: Date): string => {
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, "0");
      const day = String(d.getUTCDate()).padStart(2, "0");

      return `${y}-${m}-${day}`;
    };
    const fromYmd = ymd(ctx.range.from);
    const toYmd = ymd(ctx.range.to);

    type Triple = { p: number | null; c: number | null; f: number | null };
    const days: Triple[] = [];

    for (const r of ctx.formResponses.habits) {
      const responseDate = r.response_date;

      if (!responseDate) continue;
      if (responseDate < fromYmd || responseDate > toYmd) continue;

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
// Counts strength vs cardio sessions per period. Lee `ctx.exerciseLogs`
// (no form_responses) → no tiene equivalente form_question.

const TRAINING_SERIES = [
  { id: "strength", label: "Fuerza", default_color: "training-blue" as const },
  { id: "cardio", label: "Cardio", default_color: "cardio-rose" as const },
] as const;

const trainingBreakdown: DataAdapter = {
  metadata: {
    id: "training_breakdown",
    label: "Entrenamiento",
    category: "exercise",
    dimensions: "multi",
    series: TRAINING_SERIES,
    default_chart_type: "stacked_bar",
    default_color: TRAINING_SERIES.map((s) => s.default_color),
  },
  materialize(ctx, aggregation): BucketedPoint[] {
    const buckets = generateBuckets(
      ctx.range,
      aggregation,
      ctx.schedule,
      ctx.clientTz
    );

    return buckets.map((w) => {
      const strength = sumInWindow<ExerciseLogLike>(
        ctx.exerciseLogs,
        w,
        (log) => log.exercises?.category !== "cardio",
        ctx.schedule,
        ctx.clientTz
      );
      const cardio = sumInWindow<ExerciseLogLike>(
        ctx.exerciseLogs,
        w,
        (log) => log.exercises?.category === "cardio",
        ctx.schedule,
        ctx.clientTz
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
 * Adapters catalog VIVOS. Para agregar uno nuevo:
 *   1) Add the id to CatalogId en lib/charts/types.ts
 *   2) Add the id a catalogIdSchema en lib/charts/validation.ts
 *   3) Add the adapter aquí
 *
 * Charts huérfanos cuyo source.kind === "catalog" pero source.id no
 * está acá → filterUnusableCharts los esconde runtime.
 */
export const CATALOG_ADAPTERS: ReadonlyArray<DataAdapter> = [
  macrosBreakdown,
  trainingBreakdown,
];

/** Map for O(1) lookup. */
export const CATALOG_BY_ID = new Map(
  CATALOG_ADAPTERS.map((a) => [a.metadata.id, a])
);
