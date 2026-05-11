/**
 * Starter chart template — the seven charts that exactly reproduce today's
 * client dashboard (PESO, CALORÍAS, PROTEÍNA, HIDRATOS, GRASAS, SUEÑO,
 * ENTRENAMIENTO).
 *
 * PESO points at the `body_weight` question seeded in the check-in form
 * template (migrations 020 + 087). Each trainer can repoint it to a
 * different numeric question — or to the daily-habit `body_weight` — via
 * the chart editor.
 *
 * The migration (083_create_chart_system.sql) seeded an older shape that
 * used `{kind:"catalog", id:"weight"}`; that adapter was removed in the
 * 2026-05 cleanup. Trainers whose template was created before this change
 * will see the weight chart in its orphan empty-state until they delete
 * and re-add it via the picker.
 *
 * This TS factory is used by:
 *   - the lazy-create path in /api/charts/template GET (for trainers
 *     created after the migration ran, or whose row is missing)
 *   - the trainer template page's "Restore defaults" button when the
 *     template is empty
 */

import type { ChartConfig, ChartsDocument } from "./types";

/**
 * Isomorphic UUID generator. Node ≥19 and all modern browsers expose
 * `globalThis.crypto.randomUUID()`. Avoids importing `node:crypto`,
 * which would break the client bundle.
 */
function randomUUID(): string {
  if (typeof globalThis !== "undefined" && globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  // Fallback for environments without crypto.randomUUID — produces a v4-shaped string.
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) => {
    const n = Number(c);

    return (n ^ (Math.floor(Math.random() * 16) >> (n / 4))).toString(16);
  });
}

export function buildStarterCharts(): ChartConfig[] {
  return [
    {
      id: randomUUID(),
      position: 0,
      label: "PESO",
      source: {
        kind: "form_question",
        form_type: "checkins",
        question_id: "body_weight",
      },
      chart_type: "area",
      color: "weight-amber",
      aggregation: "checkin_period",
    },
    {
      id: randomUUID(),
      position: 1,
      label: "CALORÍAS",
      source: { kind: "catalog", id: "calories" },
      chart_type: "bar",
      color: "calorie-coral",
      aggregation: "checkin_period",
      show_average_line: true,
    },
    {
      id: randomUUID(),
      position: 2,
      label: "PROTEÍNA",
      source: { kind: "catalog", id: "protein" },
      chart_type: "bar",
      color: "protein-indigo",
      aggregation: "checkin_period",
      show_average_line: true,
    },
    {
      id: randomUUID(),
      position: 3,
      label: "HIDRATOS",
      source: { kind: "catalog", id: "carbs" },
      chart_type: "bar",
      color: "carbs-emerald-deep",
      aggregation: "checkin_period",
      show_average_line: true,
    },
    {
      id: randomUUID(),
      position: 4,
      label: "GRASAS",
      source: { kind: "catalog", id: "fats" },
      chart_type: "bar",
      color: "fats-amber-deep",
      aggregation: "checkin_period",
      show_average_line: true,
    },
    {
      id: randomUUID(),
      position: 5,
      label: "SUEÑO",
      source: { kind: "catalog", id: "sleep_hours" },
      chart_type: "bar",
      color: "sleep-emerald",
      target_zone: { min: 7, max: 9, margin: 1 },
      aggregation: "checkin_period",
    },
    {
      id: randomUUID(),
      position: 6,
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
