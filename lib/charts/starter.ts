/**
 * Starter chart template — the six charts that exactly reproduce today's
 * client dashboard (PESO, SUEÑO, CALORÍAS, PROTEÍNA, MACROS, ENTRENAMIENTO).
 *
 * The migration (083_create_chart_system.sql) seeds this same shape into
 * existing trainers' rows. This TS factory is used by:
 *   - the lazy-create path in /api/charts/template GET (for trainers
 *     created after the migration ran)
 *   - the trainer template page's "Restore defaults" button when the
 *     template is empty
 *
 * Keeping the JSON shape in lockstep between the SQL seed and this factory
 * is a load-bearing invariant. If you add or change a starter chart here,
 * you must also bump the migration's seed (or write a follow-up migration).
 */

import type { ChartConfig, ChartsDocument } from "./types";

import { randomUUID } from "node:crypto";

export function buildStarterCharts(): ChartConfig[] {
  return [
    {
      id: randomUUID(),
      position: 0,
      label: "PESO",
      source: { kind: "catalog", id: "weight" },
      chart_type: "area",
      color: "weight-amber",
      aggregation: "checkin_period",
    },
    {
      id: randomUUID(),
      position: 1,
      label: "SUEÑO",
      source: { kind: "catalog", id: "sleep_hours" },
      chart_type: "bar",
      color: "sleep-emerald",
      target_zone: { min: 7, max: 9, margin: 1 },
      aggregation: "checkin_period",
    },
    {
      id: randomUUID(),
      position: 2,
      label: "CALORÍAS",
      source: { kind: "catalog", id: "calories" },
      chart_type: "bar",
      color: "calorie-coral",
      aggregation: "checkin_period",
      show_average_line: true,
    },
    {
      id: randomUUID(),
      position: 3,
      label: "PROTEÍNA",
      source: { kind: "catalog", id: "protein" },
      chart_type: "area",
      color: "protein-indigo",
      aggregation: "checkin_period",
      show_average_line: true,
    },
    {
      id: randomUUID(),
      position: 4,
      label: "MACROS",
      source: { kind: "catalog", id: "macros_breakdown" },
      chart_type: "ring",
      color: ["protein-indigo", "carbs-emerald-deep", "fats-amber-deep"],
      aggregation: "range_total",
    },
    {
      id: randomUUID(),
      position: 5,
      label: "ENTRENAMIENTO",
      source: { kind: "catalog", id: "training_breakdown" },
      chart_type: "stacked_bar",
      color: ["training-blue", "cardio-rose"],
      aggregation: "checkin_period",
    },
  ];
}

export function buildStarterDocument(): ChartsDocument {
  return { version: 1, charts: buildStarterCharts() };
}
