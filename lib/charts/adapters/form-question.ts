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
  PhotoPoint,
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
  /**
   * Set to `"photo"` for form questions of `type: "photo"`. The adapter
   * routes through a photo timeline path instead of numeric bucketing.
   * Defaults to numeric.
   */
  kind?: "numeric" | "photo";
}

const ES_SHORT_MONTHS = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

function shortEsDateLabel(ymd: string): string {
  // ymd format: "YYYY-MM-DD". Build "4 may" / "23 dic" without going
  // through Date (which would apply local TZ shifts at midnight).
  const parts = ymd.split("-");

  if (parts.length !== 3) return ymd;
  const monthIdx = Number(parts[1]) - 1;
  const day = Number(parts[2]);

  if (
    !Number.isFinite(day) ||
    monthIdx < 0 ||
    monthIdx > 11 ||
    !ES_SHORT_MONTHS[monthIdx]
  ) {
    return ymd;
  }

  return `${day} ${ES_SHORT_MONTHS[monthIdx]}`;
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
  const isPhoto = spec.kind === "photo";

  const metadata: ChartDataSource = {
    id,
    label: spec.label,
    ...(spec.unit !== undefined ? { unit: spec.unit } : {}),
    category: spec.formType === "checkins" ? "checkin" : "habit",
    dimensions: isPhoto ? "photo" : 1,
    default_chart_type: isPhoto ? "photo_timeline" : "area",
    default_color: FALLBACK_COLOR,
    ...(isPhoto ? { icon: "solar:gallery-bold" } : {}),
  };

  const resolveNumeric = (r: FormResponse): number | null => {
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
      // Photo adapters don't produce numeric buckets; the snapshot
      // endpoint dispatches to `photoTimeline()` instead. Returning an
      // empty array here means a chart pointed at a photo question that
      // somehow got chart_type !== "photo_timeline" renders as no-data
      // rather than crashing.
      if (isPhoto) return [];
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
          resolveNumeric,
          ctx.schedule,
          ctx.clientTz
        ),
        periodTooltip: w.tooltip,
      }));
    },
    ...(isPhoto
      ? {
          photoTimeline(ctx: AdapterContext): PhotoPoint[] {
            const responses =
              spec.formType === "checkins"
                ? ctx.formResponses.checkins
                : ctx.formResponses.habits;

            const points: PhotoPoint[] = [];

            for (const r of responses) {
              if (!r.answers) continue;
              const raw = r.answers[spec.questionId];

              if (typeof raw !== "string" || raw.length === 0) continue;
              // response_date is YYYY-MM-DD; the renderer formats the
              // display label, but adapters set a sensible default so a
              // missing dateLabel never blanks out the card.
              const date = (r.response_date as string) ?? "";

              if (!date) continue;
              points.push({
                date,
                url: raw,
                label: shortEsDateLabel(date),
              });
            }

            // Oldest → newest so the renderer can render left → right
            // (progress reads naturally over time). Photos from the same
            // day are kept in array order (first submit wins for ties).
            points.sort((a, b) => a.date.localeCompare(b.date));

            // Dedupe same-day, same-url retries (offline/poor-network
            // retries can produce two form_responses for the same date).
            const deduped: PhotoPoint[] = [];
            const seen = new Set<string>();

            for (const p of points) {
              const key = `${p.date}:${p.url}`;

              if (seen.has(key)) continue;
              seen.add(key);
              deduped.push(p);
            }

            // Cap to the 60 most recent entries so a 12-month strip stays
            // bounded. With weekly check-ins × 3 angles a year would be
            // 156 photos per chart; lazy-load helps off-screen rendering
            // but the layout still allocates a DOM node per entry. 60 is
            // the same ceiling MAX_BUCKETS uses elsewhere.
            const MAX_PHOTOS = 60;

            return deduped.length > MAX_PHOTOS
              ? deduped.slice(deduped.length - MAX_PHOTOS)
              : deduped;
          },
        }
      : {}),
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
