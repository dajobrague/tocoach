/**
 * Filtra charts cuya fuente no puede resolverse en runtime para que
 * NUNCA lleguen a UI como "orphan card". El trainer puede haber
 * borrado/disabled la pregunta de check-in que un chart referencia, o
 * un catalog id puede haber sido retirado del código entre deploys.
 *
 * En lugar de mostrarle al cliente (o al trainer) un card vacío con
 * "Esta pregunta ya no existe", filtramos el chart server-side y
 * renumeramos posiciones. El documento crudo en DB queda intacto:
 * si la pregunta se re-activa, el chart vuelve solo.
 *
 * Casos cubiertos:
 *   - catalog/<id> donde <id> no está en CATALOG_BY_ID (id retirado en código)
 *   - form_question donde la pregunta no existe en form_templates
 *   - form_question donde la pregunta existe pero está disabled
 *
 * Diseño fail-open: si el lookup de form_templates falla por error,
 * devolvemos el doc sin filtrar (mejor mostrar charts viejos que
 * blankear el dashboard del cliente). El error se loguea.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChartsDocument, ChartConfig, FormType } from "../types";

import { EMPTY_CHARTS_DOCUMENT } from "../types";
import { CATALOG_BY_ID } from "../adapters/catalog";

import { normalizeFormConfig } from "@/lib/forms/types";

/**
 * Key shape: "<form_type>:<question_id>". El "form_type" puede ser
 * "checkins" o "habits" — el mismo question_id en diferentes form_types
 * es legítimamente distinto.
 */
export type QuestionKey = `${FormType}:${string}`;

function questionKey(formType: FormType, questionId: string): QuestionKey {
  return `${formType}:${questionId}` as QuestionKey;
}

/**
 * Construye el set de keys "form_type:question_id" de preguntas
 * activas y enabled para un tenant. Cubre ambos shapes de
 * questions_config (legacy array y nuevo wrapper con .questions).
 */
export async function loadValidQuestionKeys(
  supabase: SupabaseClient,
  tenantHost: string
): Promise<Set<QuestionKey>> {
  const out = new Set<QuestionKey>();

  const { data, error } = await supabase
    .from("form_templates")
    .select("form_type, questions_config, is_active")
    .eq("tenant_host", tenantHost)
    .eq("is_active", true);

  if (error) {
    // Fail-open intencional: si la query falla, no filtramos. Loguear
    // para visibilidad; los charts a tocar son los que están en DB,
    // así que el riesgo de no filtrar es solo que se muestre un card
    // vacío (no es regresión sobre el estado pre-fix).
    console.warn(
      `[charts/resolvability] loadValidQuestionKeys error tenant=${tenantHost}: ${error.message}. Skipping filter (fail-open).`
    );

    // Sentinel: vacío implica "filtrar TODO form_question". Necesitamos
    // una forma de decir "no filtrar". Devolver un Set marcado con un
    // sentinel string que el filter chequea.
    out.add("__UNAVAILABLE__:__" as QuestionKey);

    return out;
  }

  for (const row of data ?? []) {
    const formType = row.form_type as FormType;

    if (formType !== "checkins" && formType !== "habits") continue;

    let questions: ReturnType<typeof normalizeFormConfig>["questions"] = [];

    try {
      questions = normalizeFormConfig(row.questions_config).questions;
    } catch {
      continue;
    }
    for (const q of questions) {
      if (!q.id) continue;
      if (q.enabled === false) continue;
      out.add(questionKey(formType, q.id));
    }
  }

  return out;
}

function isQuestionLookupUnavailable(keys: Set<QuestionKey>): boolean {
  return keys.has("__UNAVAILABLE__:__" as QuestionKey);
}

/**
 * Decide si un chart concreto es resolvible.
 */
function isResolvable(
  chart: ChartConfig,
  validQuestionKeys: Set<QuestionKey>
): boolean {
  if (chart.source.kind === "catalog") {
    return CATALOG_BY_ID.has(chart.source.id);
  }

  if (chart.source.kind === "form_question") {
    // Fail-open: si el lookup de preguntas no estuvo disponible, no
    // filtramos form_question (asumimos OK).
    if (isQuestionLookupUnavailable(validQuestionKeys)) return true;

    return validQuestionKeys.has(
      questionKey(chart.source.form_type, chart.source.question_id)
    );
  }

  // Otros kinds futuros: por seguridad no los filtramos.
  return true;
}

/**
 * Devuelve un nuevo ChartsDocument sin los charts irresolubles.
 * Renumera `position` para mantener el contrato `position === index`.
 *
 * Si nada se filtra, devuelve la referencia original.
 *
 * Loguea un warning con la cantidad y los ids dropeados (para que el
 * trainer/ops puedan diagnosticar; el card en sí no llega a UI).
 */
export function filterUnresolvableCharts(
  doc: ChartsDocument,
  validQuestionKeys: Set<QuestionKey>,
  options?: { logContext?: string }
): ChartsDocument {
  const kept: ChartConfig[] = [];
  const dropped: Array<{ id: string; reason: string }> = [];

  for (const c of doc.charts) {
    if (isResolvable(c, validQuestionKeys)) {
      kept.push(c);
      continue;
    }
    const reason =
      c.source.kind === "catalog"
        ? `catalog id "${c.source.id}" not in registry`
        : `form_question "${c.source.form_type}:${c.source.question_id}" missing or disabled`;

    dropped.push({ id: c.id, reason });
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
