/**
 * Form-question adapter — dynamically built per (form_type, question_id)
 * from the trainer's form_templates.questions_config.
 *
 * Always 1-D. Bucketing uses the same averaging path as the catalog 1-D
 * adapters, except the resolver looks up `answers[question_id]` directly
 * (no heuristic — we trust the question_id stored in the chart config).
 *
 * The metadata id is `form_q:<form_type>:<question_id>` so the same
 * question_id existing in both check-in and daily-habit templates produces
 * two distinct adapters (and two distinct picker entries). DataSourceRef
 * carries `form_type` separately, which is the contract the validator,
 * the snapshot route, and the UI parsers rely on.
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
 * `form_q:<form_type>:<question_id>` so adapters for the same question_id
 * coming from different form types stay distinct (same id ⇒ same adapter).
 */
export function buildFormQuestionAdapter(
  spec: FormQuestionAdapterSpec
): DataAdapter {
  const id = `form_q:${spec.formType}:${spec.questionId}`;

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
      const buckets = generateBuckets(
        ctx.range,
        aggregation,
        ctx.schedule,
        ctx.clientTz
      );

      return buckets.map((w) => ({
        label: w.label,
        value: averageInWindow(
          responses,
          w,
          resolve,
          ctx.schedule,
          ctx.clientTz
        ),
        periodTooltip: w.tooltip,
      }));
    },
  };
}

/**
 * Parse a `form_q:<form_type>:<question_id>` adapter id back into its
 * constituent parts. Returns null when the input is not a form-question
 * adapter id (catalog ids, malformed ids).
 */
export function parseFormQuestionAdapterId(
  id: string
): { formType: "checkins" | "habits"; questionId: string } | null {
  if (!id.startsWith("form_q:")) return null;
  const rest = id.slice("form_q:".length);
  const sep = rest.indexOf(":");

  if (sep <= 0) return null;
  const formType = rest.slice(0, sep);

  if (formType !== "checkins" && formType !== "habits") return null;
  const questionId = rest.slice(sep + 1);

  if (questionId.length === 0) return null;

  return { formType, questionId };
}
