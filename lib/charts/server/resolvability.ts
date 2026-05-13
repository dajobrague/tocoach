/**
 * Filtra charts cuya fuente no puede producir datos para que NUNCA
 * lleguen a UI como "orphan card". Hay dos modos de fallo:
 *
 *   1. **Source inexistente**: catalog id retirado del registro, o
 *      form_question apuntando a una pregunta borrada/disabled en el
 *      tenant. resolveAdapter devolvería null o un adapter cuyo
 *      materialize nunca encuentra datos. Sin filtrar, ChartCard
 *      rendea "Esta pregunta ya no existe".
 *
 *   2. **Source válido pero sin feed**: catalog charts (mood, energy,
 *      calories, etc.) cuyas heurísticas de answer-key no matchean
 *      NINGUNA pregunta del template del tenant. El chart estaría
 *      siempre vacío silenciosamente. Equivalente estructural al
 *      caso 1 desde la perspectiva del cliente.
 *
 * En ambos casos preferimos que el chart desaparezca a que se renderee
 * un card huérfano o un eje sin datos.
 *
 * El doc en DB queda intacto: si el trainer reactiva la pregunta o
 * agrega una compatible, el chart vuelve solo.
 *
 * Diseño fail-open: si el lookup de form_templates falla por error,
 * devolvemos el doc sin filtrar (mejor mostrar charts viejos que
 * blankear el dashboard). El error se loguea.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ChartsDocument,
  ChartConfig,
  CatalogId,
  FormType,
} from "../types";

import { EMPTY_CHARTS_DOCUMENT } from "../types";
import { CATALOG_BY_ID } from "../adapters/catalog";

import {
  CATALOG_DATA_FEED,
  questionMatchesSpec,
  type FieldSpec,
} from "@/lib/forms/analytics-keys";
import { flattenQuestions } from "@/lib/forms/types";

/**
 * Una pregunta enabled del template de un tenant, con la info mínima
 * que los matchers necesitan (id + unit + label).
 */
export interface TenantQuestion {
  formType: FormType;
  id: string;
  unit: string | null;
  label: string | null;
}

export interface TenantQuestionsResult {
  questions: TenantQuestion[];
  /**
   * True cuando la query de form_templates falló. Los filtros deben
   * fail-open (no filtrar) en este caso para no blankear el dashboard
   * por un error transitorio.
   */
  unavailable: boolean;
}

const UNAVAILABLE_RESULT: TenantQuestionsResult = Object.freeze({
  questions: [],
  unavailable: true,
}) as TenantQuestionsResult;

/**
 * Lee form_templates del tenant y normaliza ambos shapes históricos
 * de questions_config (array legacy + wrapper { questions: [...] }).
 * Solo incluye preguntas enabled.
 */
export async function loadTenantQuestions(
  supabase: SupabaseClient,
  tenantHost: string
): Promise<TenantQuestionsResult> {
  const { data, error } = await supabase
    .from("form_templates")
    .select("form_type, questions_config, is_active")
    .eq("tenant_host", tenantHost)
    .eq("is_active", true);

  if (error) {
    console.warn(
      `[charts/resolvability] loadTenantQuestions error tenant=${tenantHost}: ${error.message}. Filters will fail-open.`
    );

    return UNAVAILABLE_RESULT;
  }

  const out: TenantQuestion[] = [];

  for (const row of data ?? []) {
    const formType = row.form_type as FormType;

    if (formType !== "checkins" && formType !== "habits") continue;

    // flattenQuestions desciende en subQuestions, así que captura
    // calories/protein/carbs/fats anidadas dentro de `macro_tracking`
    // y propaga enabled-from-parent (si el grupo está disabled, las
    // hijas también lo están). Antes solo se enumeraban top-level y
    // las macros eran invisibles para el filtro → habríamos escondido
    // ~100 charts vivos en producción.
    let questions: ReturnType<typeof flattenQuestions> = [];

    try {
      questions = flattenQuestions(row.questions_config);
    } catch {
      continue;
    }
    for (const q of questions) {
      if (!q.id) continue;
      if (q.enabled === false) continue;
      out.push({
        formType,
        id: q.id,
        unit: typeof q.unit === "string" ? q.unit : null,
        label: typeof q.label === "string" ? q.label : null,
      });
    }
  }

  return { questions: out, unavailable: false };
}

/** Key shape: "<form_type>:<question_id>". */
export type QuestionKey = `${FormType}:${string}`;

function questionKey(formType: FormType, questionId: string): QuestionKey {
  return `${formType}:${questionId}` as QuestionKey;
}

/**
 * Set de "form_type:question_id" para uso por el filtro form_question.
 */
export function buildValidQuestionKeys(
  result: TenantQuestionsResult
): Set<QuestionKey> {
  const out = new Set<QuestionKey>();

  for (const q of result.questions) out.add(questionKey(q.formType, q.id));

  return out;
}

/**
 * Devuelve true si el catalog id puede producir datos para este tenant.
 *   - Adapters cuyo catalog id NO esté en CATALOG_DATA_FEED (e.g.
 *     training_breakdown que lee exercise_logs) → siempre true.
 *   - macros_breakdown → matchea si protein || carbs || fats matchean.
 *   - Resto → matchea si alguna pregunta del tenant matchea el spec.
 */
function catalogHasFeed(
  catalogId: CatalogId | string,
  questions: TenantQuestion[]
): boolean {
  if (catalogId === "macros_breakdown") {
    const components: FieldSpec[] = [
      CATALOG_DATA_FEED.protein,
      CATALOG_DATA_FEED.carbs,
      CATALOG_DATA_FEED.fats,
    ].filter((s): s is FieldSpec => Boolean(s));

    return components.some((spec) =>
      questions.some((q) => questionMatchesSpec(q, spec))
    );
  }

  const spec = CATALOG_DATA_FEED[catalogId];

  // Catalog id que no declara un spec → asumimos que no depende de
  // form_responses (e.g. training_breakdown). Pasa el filtro.
  if (!spec) return true;

  return questions.some((q) => questionMatchesSpec(q, spec));
}

/**
 * Decide si un chart concreto es "usable":
 *   - source resolvible (catalog en registry, o form_question en
 *     preguntas del tenant)
 *   - para catalog: el spec del data feed matchea alguna pregunta
 */
function isChartUsable(
  chart: ChartConfig,
  validQuestionKeys: Set<QuestionKey>,
  tenantQuestions: TenantQuestion[],
  unavailable: boolean
): boolean {
  if (chart.source.kind === "catalog") {
    if (!CATALOG_BY_ID.has(chart.source.id)) return false;
    // Fail-open: si el lookup de preguntas no estuvo disponible, no
    // filtramos por feed (asumimos OK).
    if (unavailable) return true;

    return catalogHasFeed(chart.source.id, tenantQuestions);
  }

  if (chart.source.kind === "form_question") {
    if (unavailable) return true;

    return validQuestionKeys.has(
      questionKey(chart.source.form_type, chart.source.question_id)
    );
  }

  // Kinds futuros: por seguridad no los filtramos.
  return true;
}

/**
 * Clave de equivalencia para dedupar charts por su fuente subyacente.
 * Dos charts con la misma fuente producen el MISMO data feed —
 * mostrarlos ambos confunde al usuario sin agregar info. Auditoría en
 * prod (2026-05-12) reporta 0 duplicados exactos hoy; este helper es
 * defensa para evitar regresiones.
 */
function chartSourceKey(chart: ChartConfig): string {
  if (chart.source.kind === "catalog") {
    return `catalog:${chart.source.id}`;
  }
  if (chart.source.kind === "form_question") {
    return `fq:${chart.source.form_type}:${chart.source.question_id}`;
  }

  return `unknown:${JSON.stringify(chart.source)}`;
}

/**
 * Filtra duplicados dentro del mismo documento conservando el chart
 * con menor `position` (el primero en aparecer en UI). Renumera
 * posiciones tras el dedup para mantener `position === index`.
 *
 * Loguea cada drop con el id para diagnóstico.
 */
export function dedupChartsBySource(
  doc: ChartsDocument,
  options?: { logContext?: string }
): ChartsDocument {
  const seen = new Map<string, ChartConfig>();
  const dropped: Array<{ id: string; key: string }> = [];

  // Recorremos en orden de position ASC para que el "primero" sea el
  // que el trainer ve más arriba en el dashboard.
  const orderedCharts = [...doc.charts].sort((a, b) => a.position - b.position);

  for (const c of orderedCharts) {
    const key = chartSourceKey(c);

    if (seen.has(key)) {
      dropped.push({ id: c.id, key });
      continue;
    }
    seen.set(key, c);
  }

  if (dropped.length === 0) return doc;

  console.warn(
    `[charts/resolvability] dedup dropped ${dropped.length} duplicate chart(s)${
      options?.logContext ? ` (${options.logContext})` : ""
    }: ${dropped.map((d) => `${d.id}=${d.key}`).join("; ")}`
  );

  const kept = Array.from(seen.values());

  if (kept.length === 0) return { ...EMPTY_CHARTS_DOCUMENT };

  return {
    ...doc,
    charts: kept.map((c, i) => ({ ...c, position: i })),
  };
}

/**
 * Devuelve un nuevo ChartsDocument sin los charts inutilizables.
 * Renumera `position` para mantener `position === index`.
 *
 * Si nada se filtra, devuelve la referencia original.
 *
 * Loguea los ids dropeados (el card en sí no llega a UI; este log es
 * para diagnóstico de ops / trainer support).
 */
export function filterUnusableCharts(
  doc: ChartsDocument,
  tenantQuestionsResult: TenantQuestionsResult,
  options?: { logContext?: string }
): ChartsDocument {
  const validQuestionKeys = buildValidQuestionKeys(tenantQuestionsResult);
  const kept: ChartConfig[] = [];
  const dropped: Array<{ id: string; reason: string }> = [];

  for (const c of doc.charts) {
    if (
      isChartUsable(
        c,
        validQuestionKeys,
        tenantQuestionsResult.questions,
        tenantQuestionsResult.unavailable
      )
    ) {
      kept.push(c);
      continue;
    }

    let reason: string;

    if (c.source.kind === "catalog") {
      reason = CATALOG_BY_ID.has(c.source.id)
        ? `catalog "${c.source.id}" has no matching question in tenant template`
        : `catalog id "${c.source.id}" not in registry`;
    } else if (c.source.kind === "form_question") {
      reason = `form_question "${c.source.form_type}:${c.source.question_id}" missing or disabled`;
    } else {
      reason = "unknown source kind";
    }

    dropped.push({ id: c.id, reason });
  }

  if (dropped.length === 0) return doc;

  console.warn(
    `[charts/resolvability] dropped ${dropped.length} unusable chart(s)${
      options?.logContext ? ` (${options.logContext})` : ""
    }: ${dropped.map((d) => `${d.id}=${d.reason}`).join("; ")}`
  );

  if (kept.length === 0) return { ...EMPTY_CHARTS_DOCUMENT };

  return {
    ...doc,
    charts: kept.map((c, i) => ({ ...c, position: i })),
  };
}

// ─── Deprecated re-exports (legacy callers) ──────────────────────────────

/**
 * @deprecated Use loadTenantQuestions + filterUnusableCharts. Mantenido
 * por compat retro si algún caller externo lo importa.
 */
export async function loadValidQuestionKeys(
  supabase: SupabaseClient,
  tenantHost: string
): Promise<Set<QuestionKey>> {
  const result = await loadTenantQuestions(supabase, tenantHost);

  if (result.unavailable) {
    // Mantiene el sentinel-set para que filterUnresolvableCharts viejo
    // siga haciendo fail-open.
    const out = new Set<QuestionKey>();

    out.add("__UNAVAILABLE__:__" as QuestionKey);

    return out;
  }

  return buildValidQuestionKeys(result);
}

/**
 * @deprecated Use filterUnusableCharts en su lugar.
 */
export function filterUnresolvableCharts(
  doc: ChartsDocument,
  validQuestionKeys: Set<QuestionKey>,
  options?: { logContext?: string }
): ChartsDocument {
  const unavailable = validQuestionKeys.has(
    "__UNAVAILABLE__:__" as QuestionKey
  );
  const kept: ChartConfig[] = [];
  const dropped: Array<{ id: string; reason: string }> = [];

  for (const c of doc.charts) {
    let usable = true;

    if (c.source.kind === "catalog") {
      usable = CATALOG_BY_ID.has(c.source.id);
    } else if (c.source.kind === "form_question") {
      usable =
        unavailable ||
        validQuestionKeys.has(
          questionKey(c.source.form_type, c.source.question_id)
        );
    }

    if (usable) {
      kept.push(c);
    } else {
      const reason =
        c.source.kind === "catalog"
          ? `catalog id "${c.source.id}" not in registry`
          : c.source.kind === "form_question"
            ? `form_question "${c.source.form_type}:${c.source.question_id}" missing or disabled`
            : "unknown";

      dropped.push({ id: c.id, reason });
    }
  }

  if (dropped.length === 0) return doc;

  console.warn(
    `[charts/resolvability] dropped ${dropped.length} unresolvable chart(s)${
      options?.logContext ? ` (${options.logContext})` : ""
    }: ${dropped.map((d) => `${d.id}=${d.reason}`).join("; ")}`
  );

  if (kept.length === 0) return { ...EMPTY_CHARTS_DOCUMENT };

  return {
    ...doc,
    charts: kept.map((c, i) => ({ ...c, position: i })),
  };
}
