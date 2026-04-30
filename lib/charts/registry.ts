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
import type { CatalogId, ChartConfig, DataSourceRef } from "./types";
import type { DataAdapter } from "./adapters/types";

import { z } from "zod";

import { CATALOG_BY_ID, CATALOG_ADAPTERS } from "./adapters/catalog";
import { buildFormQuestionAdapter } from "./adapters/form-question";

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
 * Subset of the form_templates row we read. `questions_config` is a JSONB
 * array of `{ id, type, label, unit?, ... }` per question.
 *
 * The shape is loose because question definitions evolve — we only
 * promise to read `id`, `type`, `label`, and `unit` from each entry.
 */
export interface FormTemplateRow {
  form_type: FormType;
  questions_config: ReadonlyArray<{
    id: string;
    type: string;
    label?: string;
    unit?: string;
  }>;
}

const NUMERIC_QUESTION_TYPES = new Set([
  "number",
  "integer",
  "decimal",
  "float",
]);

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
    for (const q of tpl.questions_config) {
      if (!NUMERIC_QUESTION_TYPES.has(String(q.type).toLowerCase())) continue;
      if (!q.id) continue;
      out.push(
        buildFormQuestionAdapter({
          formType: tpl.form_type as FormType,
          questionId: q.id,
          label: q.label || q.id,
          ...(q.unit !== undefined ? { unit: q.unit } : {}),
        })
      );
    }
  }

  return out;
}

/**
 * Catalog + form-question adapters, deduped (catalog wins on id collision —
 * a trainer can't override a catalog adapter by naming a form question
 * "weight"). Order: catalog first (in their predefined order), then form
 * questions in the order returned by the templates query.
 */
export function listAvailableSources(
  templates: ReadonlyArray<FormTemplateRow>
): DataAdapter[] {
  const seen = new Set<string>();
  const merged: DataAdapter[] = [];

  for (const a of CATALOG_ADAPTERS) {
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
  cfg: ChartConfig,
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
  const isMulti = adapter.metadata.dimensions === "multi";

  if (wantsMulti && !isMulti) {
    issues.push({
      code: "custom",
      input: cfg.chart_type,
      message: `${cfg.chart_type} requires a multi-dim source; ${adapter.metadata.id} is 1-D`,
      path: ["charts", index, "chart_type"],
    });
  }
  if (!wantsMulti && isMulti) {
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
  charts: ReadonlyArray<ChartConfig>
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
