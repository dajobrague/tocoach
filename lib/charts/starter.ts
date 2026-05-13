/**
 * Starter chart template — seven charts apuntando a las preguntas reales
 * del template del trainer (PESO, CALORÍAS, PROTEÍNA, HIDRATOS, GRASAS,
 * SUEÑO, ENTRENAMIENTO).
 *
 * Dos modos:
 *   - `buildStarterCharts()` — versión legacy hardcoded usada como
 *     fallback en el cliente "Restaurar default" y en el path ephemeral
 *     del loader (tenant sin row en `tenants`). PESO viene como
 *     form_question/checkins/body_weight; el resto como catalog/* que
 *     el filtro de resolvability esconderá si el tenant no tiene la
 *     pregunta. Sin iconos default.
 *   - `buildStarterChartsFromTemplates(templates)` — versión
 *     template-aware: inspecciona el form_templates real del trainer
 *     (descendiendo en subQuestions) y siembra form_question puro
 *     apuntando a las preguntas concretas. Si una intent no tiene
 *     match en el template del tenant, skipea ese chart (cero
 *     orphans). Esta es la versión "personalización absoluta" que el
 *     loader llama al lazy-create de un nuevo trainer.
 */

import type { ChartConfig, ChartsDocument, ColorToken } from "./types";
import type { QuestionConfig } from "@/lib/forms/types";

import {
  CATALOG_DATA_FEED,
  questionMatchesSpec,
  type FieldSpec,
} from "@/lib/forms/analytics-keys";
import { flattenQuestions } from "@/lib/forms/types";

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

/**
 * Legacy hardcoded starter — usado como fallback en el cliente
 * ("Restaurar default" en chart-surface) y en el path ephemeral del
 * loader (tenant sin row). Asume las preguntas del template default
 * (migration 020): body_weight, sleep_hours, steps, y las macros
 * anidadas calories/protein/carbs/fats dentro de macro_tracking.
 *
 * Si el trainer ya disabled / borró una de esas preguntas, el chart
 * correspondiente quedará huérfano y el filtro de resolvability lo
 * esconderá. Para trainers nuevos, el server-side
 * `buildStarterChartsFromTemplates` se prefiere y detecta el template
 * real (incluyendo preguntas custom anidadas).
 *
 * Sin iconos default: el trainer los configura desde el icon picker.
 */
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
      source: {
        kind: "form_question",
        form_type: "habits",
        question_id: "calories",
      },
      chart_type: "bar",
      color: "calorie-coral",
      aggregation: "checkin_period",
      show_average_line: true,
    },
    {
      id: randomUUID(),
      position: 2,
      label: "PROTEÍNA",
      source: {
        kind: "form_question",
        form_type: "habits",
        question_id: "protein",
      },
      chart_type: "bar",
      color: "protein-indigo",
      aggregation: "checkin_period",
      show_average_line: true,
    },
    {
      id: randomUUID(),
      position: 3,
      label: "HIDRATOS",
      source: {
        kind: "form_question",
        form_type: "habits",
        question_id: "carbs",
      },
      chart_type: "bar",
      color: "carbs-emerald-deep",
      aggregation: "checkin_period",
      show_average_line: true,
    },
    {
      id: randomUUID(),
      position: 4,
      label: "GRASAS",
      source: {
        kind: "form_question",
        form_type: "habits",
        question_id: "fats",
      },
      chart_type: "bar",
      color: "fats-amber-deep",
      aggregation: "checkin_period",
      show_average_line: true,
    },
    {
      id: randomUUID(),
      position: 5,
      label: "SUEÑO",
      source: {
        kind: "form_question",
        form_type: "habits",
        question_id: "sleep_hours",
      },
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

// ─── Template-aware starter ────────────────────────────────────────────

/**
 * Una "intent" del starter: WHAT queremos (label + chart_type + color)
 * y HOW encontrar la pregunta que la alimenta en el template del
 * trainer (vía FieldSpec). Si no encontramos pregunta compatible,
 * la intent se skipea — cero orphans.
 *
 * Cada intent tiene un `id` que controla el orden y permite dedup
 * (no duplicar PESO si ya está incluido vía otra ruta).
 */
interface StarterIntent {
  id: string;
  label: string;
  spec: FieldSpec;
  chart_type: ChartConfig["chart_type"];
  color: ColorToken;
  aggregation: ChartConfig["aggregation"];
  target_zone?: { min: number; max: number; margin: number };
  show_average_line?: boolean;
}

const STARTER_INTENTS: ReadonlyArray<StarterIntent> = [
  {
    id: "weight",
    label: "PESO",
    spec: CATALOG_DATA_FEED.weight!,
    chart_type: "area",
    color: "weight-amber",
    aggregation: "checkin_period",
  },
  {
    id: "calories",
    label: "CALORÍAS",
    spec: CATALOG_DATA_FEED.calories!,
    chart_type: "bar",
    color: "calorie-coral",
    aggregation: "checkin_period",
    show_average_line: true,
  },
  {
    id: "protein",
    label: "PROTEÍNA",
    spec: CATALOG_DATA_FEED.protein!,
    chart_type: "bar",
    color: "protein-indigo",
    aggregation: "checkin_period",
    show_average_line: true,
  },
  {
    id: "carbs",
    label: "HIDRATOS",
    spec: CATALOG_DATA_FEED.carbs!,
    chart_type: "bar",
    color: "carbs-emerald-deep",
    aggregation: "checkin_period",
    show_average_line: true,
  },
  {
    id: "fats",
    label: "GRASAS",
    spec: CATALOG_DATA_FEED.fats!,
    chart_type: "bar",
    color: "fats-amber-deep",
    aggregation: "checkin_period",
    show_average_line: true,
  },
  {
    id: "sleep_hours",
    label: "SUEÑO",
    spec: CATALOG_DATA_FEED.sleep_hours!,
    chart_type: "bar",
    color: "sleep-emerald",
    aggregation: "checkin_period",
    target_zone: { min: 7, max: 9, margin: 1 },
  },
];

export interface StarterTemplateRow {
  form_type: "checkins" | "habits";
  questions_config: unknown;
}

interface FlatQuestion {
  formType: "checkins" | "habits";
  id: string;
  unit: string | null;
}

function flattenTemplates(
  templates: ReadonlyArray<StarterTemplateRow>
): FlatQuestion[] {
  const out: FlatQuestion[] = [];

  for (const tpl of templates) {
    if (tpl.form_type !== "checkins" && tpl.form_type !== "habits") continue;

    let questions: QuestionConfig[] = [];

    try {
      // flattenQuestions desciende subQuestions y propaga
      // enabled-from-parent. Así descubre calories/protein/carbs/fats
      // anidadas en macro_tracking.
      questions = flattenQuestions(
        tpl.questions_config as QuestionConfig[] | never
      );
    } catch {
      continue;
    }
    for (const q of questions) {
      if (!q.id) continue;
      if (q.enabled === false) continue;
      out.push({
        formType: tpl.form_type,
        id: q.id,
        unit: typeof q.unit === "string" ? q.unit : null,
      });
    }
  }

  return out;
}

/**
 * Construye charts del starter usando las preguntas reales del trainer.
 * Para cada intent, busca la mejor pregunta compatible (canonical
 * primero, luego substring, luego unit). Si no encuentra ninguna,
 * skipea la intent. El chart ENTRENAMIENTO se agrega siempre porque
 * lee `exercise_logs` (no depende de form_responses).
 */
export function buildStarterChartsFromTemplates(
  templates: ReadonlyArray<StarterTemplateRow>
): ChartConfig[] {
  const questions = flattenTemplates(templates);
  const out: ChartConfig[] = [];

  for (const intent of STARTER_INTENTS) {
    const match = questions.find((q) => questionMatchesSpec(q, intent.spec));

    if (!match) continue;

    out.push({
      id: randomUUID(),
      position: out.length,
      label: intent.label,
      source: {
        kind: "form_question",
        form_type: match.formType,
        question_id: match.id,
      },
      chart_type: intent.chart_type,
      color: intent.color,
      aggregation: intent.aggregation,
      ...(intent.target_zone ? { target_zone: intent.target_zone } : {}),
      ...(intent.show_average_line
        ? { show_average_line: intent.show_average_line }
        : {}),
    });
  }

  // ENTRENAMIENTO siempre: lee exercise_logs, independiente del form template.
  out.push({
    id: randomUUID(),
    position: out.length,
    label: "ENTRENAMIENTO",
    source: { kind: "catalog", id: "training_breakdown" },
    chart_type: "stacked_bar",
    color: ["training-blue", "cardio-rose"],
    aggregation: "checkin_period",
  });

  return out;
}

export function buildStarterDocumentFromTemplates(
  templates: ReadonlyArray<StarterTemplateRow>
): ChartsDocument {
  return { version: 1, charts: buildStarterChartsFromTemplates(templates) };
}
