/**
 * Adapter registry — the single bridge between a stored ChartConfig
 * (ref-by-id) and a runtime DataAdapter (knows how to produce buckets).
 *
 * Two responsibilities:
 *   1) `resolveAdapter(ref)` — sync. Given a DataSourceRef, return the
 *      runtime adapter. Used at chart-render time. For catalog sources
 *      this is an O(1) lookup; for form_question sources it builds a
 *      fresh adapter shell (the question label/unit are not needed at
 *      render time because ChartConfig.label is what the card shows).
 *
 *   2) `listAvailableSources(trainerId)` — async. Returns the catalog
 *      adapters PLUS one form-question adapter per numeric question the
 *      trainer has defined. Used by the data-source picker.
 *
 * Also hosts `validateChartConfigWithRegistry` — the second-pass
 * validator that confirms chart_type ↔ adapter.dimensions agreement.
 * Structural validation lives in lib/charts/validation.ts; that pass is
 * what the API routes' fast 422 path runs. This one runs after, with
 * the registry available.
 */

import type { FormType } from "./types";
import type { CatalogId, DataSourceRef } from "./types";
import type { DataAdapter } from "./adapters/types";
import type { ChartConfigInput } from "./validation";
import type { FormConfigData, QuestionConfig } from "@/lib/forms/types";

import { z } from "zod";

import { CATALOG_BY_ID, CATALOG_ADAPTERS } from "./adapters/catalog";
import { buildFormQuestionAdapter } from "./adapters/form-question";

import { flattenQuestions } from "@/lib/forms/types";
import {
  CATALOG_DATA_FEED,
  questionMatchesSpec,
} from "@/lib/forms/analytics-keys";

/**
 * Registry-validation accepts the zod-inferred shape (ChartConfigInput)
 * so the API routes can chain `parsed.data.charts → validateDocument…`
 * without an extra cast under exactOptionalPropertyTypes.
 */
type ChartLike = ChartConfigInput;

// ─── Resolve ──────────────────────────────────────────────────────────────

/**
 * Map a stored DataSourceRef to a runtime adapter.
 * Returns undefined when the reference can't be resolved (catalog id
 * removed in code, or anything else that fails sanity). The caller
 * should treat undefined as "render the orphan empty-state."
 */
export function resolveAdapter(ref: DataSourceRef): DataAdapter | undefined {
  if (ref.kind === "catalog") {
    return CATALOG_BY_ID.get(ref.id);
  }

  // form_question — build on-demand. Label/unit come from ChartConfig at
  // render time; this shell is enough for `materialize`.
  return buildFormQuestionAdapter({
    formType: ref.form_type,
    questionId: ref.question_id,
    label: ref.question_id, // placeholder; real label is on ChartConfig
  });
}

// ─── Numeric form question discovery ──────────────────────────────────────

/**
 * Subset of the form_templates row we read. `questions_config` is JSONB
 * but its concrete shape can be EITHER:
 *   - the legacy flat array `QuestionConfig[]`, or
 *   - the new structured wrapper `{ pages, questions }` (`FormConfigData`).
 *
 * `normalizeFormConfig` from @/lib/forms/types handles both. We treat the
 * raw value as `unknown` here and normalize before reading questions.
 */
export interface FormTemplateRow {
  form_type: FormType;
  questions_config: unknown;
}

/**
 * Question types we accept as numeric. The codebase's `QuestionType` enum
 * is `rating | number | text | boolean | photo | group | choice |
 * multi_choice` — only `number` and `rating` produce numeric answers
 * suitable for charting.
 */
const NUMERIC_QUESTION_TYPES = new Set(["number", "rating"]);

/**
 * Question types that surface as photo-timeline sources. Only `photo` at
 * the moment — `group` containers with photo sub-questions are deferred
 * to a follow-up (would require expansion logic in the adapter).
 */
const PHOTO_QUESTION_TYPES = new Set(["photo"]);

function isQuestionConfigArray(v: unknown): v is QuestionConfig[] {
  return Array.isArray(v);
}

function isStructuredFormConfig(v: unknown): v is FormConfigData {
  return (
    !!v &&
    typeof v === "object" &&
    !Array.isArray(v) &&
    "questions" in (v as Record<string, unknown>)
  );
}

/**
 * Pull a flat `QuestionConfig[]` out of a `questions_config` JSONB cell,
 * handling both legacy and structured shapes. Returns an empty array when
 * the cell is null / malformed (so the API route stays a 200, not a 500).
 *
 * Usa `flattenQuestions` (no `normalizeFormConfig`) para descender en
 * subQuestions y exponer preguntas anidadas en groups (e.g.
 * calories/protein/carbs/fats dentro de `macro_tracking`). El picker
 * del trainer y el filtro de resolvability dependen de esto para
 * mostrar/aceptar preguntas que viven dentro de groups.
 */
function extractQuestions(raw: unknown): QuestionConfig[] {
  if (isQuestionConfigArray(raw) || isStructuredFormConfig(raw)) {
    return flattenQuestions(raw);
  }

  return [];
}

/**
 * Enumerate every numeric question across the trainer's form templates
 * as a registry of form-question adapters. Catalog adapters are added
 * separately via `listAvailableSources`.
 */
export function buildFormQuestionAdaptersFromTemplates(
  templates: ReadonlyArray<FormTemplateRow>
): DataAdapter[] {
  const out: DataAdapter[] = [];

  for (const tpl of templates) {
    if (tpl.form_type !== "checkins" && tpl.form_type !== "habits") continue;
    const questions = extractQuestions(tpl.questions_config);

    for (const q of questions) {
      if (!q.id) continue;
      if (q.enabled === false) continue;
      const qType = String(q.type).toLowerCase();
      const isNumeric = NUMERIC_QUESTION_TYPES.has(qType);
      const isPhoto = PHOTO_QUESTION_TYPES.has(qType);

      if (!isNumeric && !isPhoto) continue;
      out.push(
        buildFormQuestionAdapter({
          formType: tpl.form_type,
          questionId: q.id,
          label: q.label || q.id,
          ...(q.unit !== undefined ? { unit: q.unit } : {}),
          ...(isPhoto ? { kind: "photo" as const } : {}),
        })
      );
    }
  }

  return out;
}

/**
 * Catalog + form-question adapters, deduped. Order: catalog first (en su
 * orden predefinido), después form_question en el orden del template.
 *
 * Filtro de duplicación con form_question:
 *   Un catalog/X que tiene un FieldSpec declarado en CATALOG_DATA_FEED
 *   se ESCONDE del picker cuando el tenant tiene al menos una pregunta
 *   que matchea ese spec (típicamente la pregunta nativa del template
 *   default). El trainer no debería ver "Calorías (catálogo)" Y
 *   "Calorías Totales (mi template)" en la misma lista — son la misma
 *   cosa con dos rutas.
 *
 *   Excepciones que siempre se muestran:
 *     - training_breakdown: no depende de form_responses (lee
 *       exercise_logs), no tiene equivalente form_question
 *     - macros_breakdown: composite multi-series; el form_question no
 *       lo reemplaza directamente
 *   Estos NO están en CATALOG_DATA_FEED y por eso pasan el filtro.
 */
export function listAvailableSources(
  templates: ReadonlyArray<FormTemplateRow>
): DataAdapter[] {
  const seen = new Set<string>();
  const merged: DataAdapter[] = [];

  // Pre-computar las preguntas planas del tenant para el filtro.
  const tenantQuestions: Array<{ id?: string | null; unit?: string | null }> =
    [];

  for (const tpl of templates) {
    if (tpl.form_type !== "checkins" && tpl.form_type !== "habits") continue;
    const questions = extractQuestions(tpl.questions_config);

    for (const q of questions) {
      if (!q.id) continue;
      if (q.enabled === false) continue;
      tenantQuestions.push({
        id: q.id,
        unit: typeof q.unit === "string" ? q.unit : null,
      });
    }
  }

  function catalogIsRedundant(catalogId: string): boolean {
    const spec = CATALOG_DATA_FEED[catalogId];

    if (!spec) return false; // no spec → siempre se muestra (training_breakdown, etc.)

    return tenantQuestions.some((q) => questionMatchesSpec(q, spec));
  }

  for (const a of CATALOG_ADAPTERS) {
    if (catalogIsRedundant(a.metadata.id)) continue;
    seen.add(a.metadata.id);
    merged.push(a);
  }
  for (const a of buildFormQuestionAdaptersFromTemplates(templates)) {
    if (seen.has(a.metadata.id)) continue;
    seen.add(a.metadata.id);
    merged.push(a);
  }

  return merged;
}

// ─── Adapter-aware validation ─────────────────────────────────────────────

/**
 * Second-pass validation: `chart_type ↔ resolved adapter.dimensions` and
 * color-array length matches series count for multi-dim sources.
 *
 * Returns `{ valid: true }` or `{ valid: false, error: ZodError }` so
 * the caller can format the error consistently with the structural pass.
 */
export function validateChartConfigWithRegistry(
  cfg: ChartLike,
  index = 0
): { valid: true } | { valid: false; issues: z.core.$ZodIssue[] } {
  const issues: z.core.$ZodIssue[] = [];

  const adapter = resolveAdapter(cfg.source);

  if (!adapter) {
    issues.push({
      code: "custom",
      input: cfg.source,
      message: `Unknown data source: ${
        cfg.source.kind === "catalog"
          ? cfg.source.id
          : `${cfg.source.form_type}:${cfg.source.question_id}`
      }`,
      path: ["charts", index, "source"],
    });

    return { valid: false, issues };
  }

  const wantsMulti =
    cfg.chart_type === "ring" || cfg.chart_type === "stacked_bar";
  const wantsPhoto = cfg.chart_type === "photo_timeline";
  const isMulti = adapter.metadata.dimensions === "multi";
  const isPhoto = adapter.metadata.dimensions === "photo";

  // photo_timeline ↔ photo source
  if (wantsPhoto && !isPhoto) {
    issues.push({
      code: "custom",
      input: cfg.chart_type,
      message: `photo_timeline requires a photo source; ${adapter.metadata.id} is ${isMulti ? "multi-dim" : "1-D"}`,
      path: ["charts", index, "chart_type"],
    });
  }
  if (!wantsPhoto && isPhoto) {
    issues.push({
      code: "custom",
      input: cfg.chart_type,
      message: `${cfg.chart_type} cannot be backed by a photo source (${adapter.metadata.id})`,
      path: ["charts", index, "chart_type"],
    });
  }

  if (wantsMulti && !isMulti) {
    issues.push({
      code: "custom",
      input: cfg.chart_type,
      message: `${cfg.chart_type} requires a multi-dim source; ${adapter.metadata.id} is 1-D`,
      path: ["charts", index, "chart_type"],
    });
  }
  if (!wantsMulti && !wantsPhoto && isMulti) {
    issues.push({
      code: "custom",
      input: cfg.chart_type,
      message: `${cfg.chart_type} cannot be backed by a multi-dim source (${adapter.metadata.id})`,
      path: ["charts", index, "chart_type"],
    });
  }

  if (isMulti && Array.isArray(cfg.color)) {
    const expected = adapter.metadata.series?.length ?? 0;

    if (cfg.color.length !== expected) {
      issues.push({
        code: "custom",
        input: cfg.color,
        message: `${adapter.metadata.id} has ${expected} series; color array length is ${cfg.color.length}`,
        path: ["charts", index, "color"],
      });
    }
  }

  if (issues.length === 0) return { valid: true };

  return { valid: false, issues };
}

/**
 * Validate every chart in a document against the registry. Aggregates
 * issues from each chart's pass.
 */
export function validateDocumentWithRegistry(
  charts: ReadonlyArray<ChartLike>
): { valid: true } | { valid: false; issues: z.core.$ZodIssue[] } {
  const all: z.core.$ZodIssue[] = [];

  charts.forEach((cfg, i) => {
    const r = validateChartConfigWithRegistry(cfg, i);

    if (!r.valid) all.push(...r.issues);
  });
  if (all.length === 0) return { valid: true };

  return { valid: false, issues: all };
}

// ─── Re-exports for convenience ───────────────────────────────────────────

export { CATALOG_ADAPTERS, CATALOG_BY_ID } from "./adapters/catalog";
export { buildFormQuestionAdapter } from "./adapters/form-question";
export type { DataAdapter, AdapterContext } from "./adapters/types";

// Catalog id branding for the picker (cheap helper — keeps `CatalogId`
// the type from types.ts as the only source of truth).
export type { CatalogId };
