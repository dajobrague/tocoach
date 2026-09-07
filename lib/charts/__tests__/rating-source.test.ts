/**
 * Regresión (feedback David 2026-09-03): una gráfica de valoración 1–5
 * mostraba "52,3" con cinco estrellas en la vista previa del editor.
 *
 * Causa raíz: el tipo de la pregunta nunca llegaba a la capa de charts —
 * la demo caía al preset 0–100 y el render adivinaba "es rating" por
 * substring del id. El tipo debe viajar en la metadata de la fuente.
 */
import type { ChartConfig } from "@/lib/charts/types";

import { describe, expect, it } from "vitest";

import { synthesizeDemoBuckets } from "@/components/charts/demo-data";
import { RATING_MAX } from "@/lib/forms/types";
import {
  buildFormQuestionAdaptersFromTemplates,
  resolveAdapter,
} from "@/lib/charts/registry";

const RATING_TEMPLATE = {
  form_type: "checkins" as const,
  questions_config: [
    {
      id: "service_rating",
      label: "Valoración del Servicio",
      icon: "solar:star-bold",
      type: "rating",
      enabled: true,
      required: false,
    },
    {
      id: "body_weight",
      label: "Peso",
      icon: "solar:scale-bold",
      type: "number",
      unit: "kg",
      enabled: true,
      required: false,
    },
  ],
};

describe("rating questions reach the chart layer as metadata", () => {
  it("template discovery marks rating questions with y_max and rating", () => {
    const sources = buildFormQuestionAdaptersFromTemplates([RATING_TEMPLATE]);
    const rating = sources.find((a) =>
      a.metadata.id.endsWith(":service_rating")
    );
    const weight = sources.find((a) => a.metadata.id.endsWith(":body_weight"));

    expect(rating?.metadata.rating).toBe(true);
    expect(rating?.metadata.y_max).toBe(RATING_MAX);
    expect(weight?.metadata.rating).toBeUndefined();
    expect(weight?.metadata.unit).toBe("kg");
  });

  it("resolveAdapter merges the matching source metadata into the shell", () => {
    const sources = buildFormQuestionAdaptersFromTemplates([
      RATING_TEMPLATE,
    ]).map((a) => a.metadata);
    const adapter = resolveAdapter(
      {
        kind: "form_question",
        form_type: "checkins",
        question_id: "service_rating",
      },
      { sources }
    );

    expect(adapter?.metadata.rating).toBe(true);
    expect(adapter?.metadata.y_max).toBe(RATING_MAX);
    expect(adapter?.metadata.label).toBe("Valoración del Servicio");
  });

  it("demo data for a rating source stays inside 1..RATING_MAX as integers", () => {
    const chart: ChartConfig = {
      id: "demo-rating",
      position: 0,
      label: "VALORACIÓN",
      source: {
        kind: "form_question",
        form_type: "checkins",
        question_id: "service_rating",
      },
      chart_type: "area",
      color: "training-blue",
      aggregation: "checkin_period",
    };
    const source = buildFormQuestionAdaptersFromTemplates([
      RATING_TEMPLATE,
    ]).find((a) => a.metadata.rating === true)?.metadata;
    const buckets = synthesizeDemoBuckets(chart, source);

    expect(buckets.length).toBeGreaterThan(0);
    for (const b of buckets) {
      expect(typeof b.value).toBe("number");
      const v = b.value as number;

      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(RATING_MAX);
    }
  });
});
