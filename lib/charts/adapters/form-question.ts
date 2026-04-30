/**
 * Form-question adapter — dynamically built per question_id from the
 * trainer's form_templates.questions_config.
 *
 * Always 1-D. Bucketing uses the same averaging path as the catalog 1-D
 * adapters, except the resolver looks up `answers[question_id]` directly
 * (no heuristic — we trust the question_id stored in the chart config).
 *
 * If the question gets deleted or has its type changed away from numeric,
 * the surface will see no data come through and render the orphan
 * empty-state. The registry's `listAvailableSources` is what decides
 * whether to expose a question in the picker; this adapter just produces
 * empty-or-real buckets for whatever it's pointed at.
 */

import type { FormResponse } from "@/lib/forms/types";
import type {
  Aggregation,
  BucketedPoint,
  ChartDataSource,
  ColorToken,
  FormType,
} from "../types";
import type { AdapterContext, DataAdapter } from "./types";

import { averageInWindow, generateBuckets } from "./bucketing";

export interface FormQuestionAdapterSpec {
  /** The form_type the question lives in. */
  formType: FormType;
  /** Stable question id from form_templates.questions_config[].id */
  questionId: string;
  /** Trainer's chosen label (falls back to the question label). */
  label: string;
  /** Optional unit suffix (e.g. "cm", "kg"). */
  unit?: string;
}

const FALLBACK_COLOR: ColorToken = "neutral-slate";

/**
 * Build a runtime adapter for a single form question. Stable id is
 * `form_q:<question_id>` so two adapters built for the same question
 * compare equal by metadata.id.
 */
export function buildFormQuestionAdapter(
  spec: FormQuestionAdapterSpec
): DataAdapter {
  const id = `form_q:${spec.questionId}`;

  const metadata: ChartDataSource = {
    id,
    label: spec.label,
    ...(spec.unit !== undefined ? { unit: spec.unit } : {}),
    category: spec.formType === "checkins" ? "checkin" : "habit",
    dimensions: 1,
    default_chart_type: "area",
    default_color: FALLBACK_COLOR,
  };

  const resolve = (r: FormResponse): number | null => {
    if (!r.answers) return null;
    if (!(spec.questionId in r.answers)) return null;
    const raw = r.answers[spec.questionId];

    if (raw === null || raw === undefined || raw === "") return null;
    const n = Number(raw);

    return Number.isFinite(n) ? n : null;
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
        value: averageInWindow(responses, w, resolve, ctx.schedule),
        periodTooltip: w.tooltip,
      }));
    },
  };
}
