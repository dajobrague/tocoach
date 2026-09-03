/**
 * Formato de presentación por métrica conocida — unidad junto al valor
 * y estrellas para valoraciones 1–5 (feedback JC sep-2026).
 *
 * Mapa FIJO por tipo de métrica: no hay columna `unit` por chart ni UI
 * de configuración (decisión D1-b). En render solo tenemos el
 * `question_id` (el adapter shell de form_question no trae unit), así
 * que reutilizamos los FieldSpec de analytics-keys — la misma heurística
 * canonical → substring que usa el starter para encontrar cada pregunta.
 * Las métricas custom que no matchean ningún spec no muestran unidad.
 */

import type { DataSourceRef } from "./types";

import {
  CATALOG_DATA_FEED,
  questionMatchesSpec,
} from "@/lib/forms/analytics-keys";

export interface MetricFormat {
  /** Sufijo mostrado junto al valor ("kg", "kcal", …). */
  unit?: string;
  /** Valoración 1–5: se pinta con estrellas en lugar de número pelado. */
  rating?: true;
}

// Orden = prioridad cuando un id ambiguo matchea varios specs
// (e.g. "hidrat" está en carbs Y water; carbs gana).
const UNIT_BY_SPEC: ReadonlyArray<[spec: string, unit: string]> = [
  ["weight", "kg"],
  ["body_fat", "%"],
  ["calories", "kcal"],
  ["protein", "g"],
  ["carbs", "g"],
  ["fats", "g"],
  ["sleep_hours", "h"],
  ["steps", "pasos"],
  ["water", "L"],
];

const RATING_SPECS = ["mood", "energy", "stress"] as const;

// Preguntas `type: "rating"` del template default (lib/forms/defaults.ts)
// que no tienen FieldSpec propio.
const RATING_QUESTION_IDS = new Set([
  "service_rating",
  "hunger_levels",
  "adherence",
  "morning_feeling",
]);

export function metricFormat(source: DataSourceRef): MetricFormat {
  if (source.kind !== "form_question") return {};
  const question = { id: source.question_id };

  // Ratings primero: "sleep_quality" contiene "sleep" y caería en horas.
  if (
    RATING_QUESTION_IDS.has(question.id) ||
    RATING_SPECS.some((key) => {
      const spec = CATALOG_DATA_FEED[key];

      return spec !== undefined && questionMatchesSpec(question, spec);
    })
  ) {
    return { rating: true };
  }

  for (const [key, unit] of UNIT_BY_SPEC) {
    const spec = CATALOG_DATA_FEED[key];

    if (spec !== undefined && questionMatchesSpec(question, spec)) {
      return { unit };
    }
  }

  return {};
}
