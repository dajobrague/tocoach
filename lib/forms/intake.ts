import type { FormConfigData, QuestionConfig } from "@/lib/forms/types";

/**
 * Formulario inicial (`form_type = 'intake'`): lo que el entrenador quiere
 * saber de un cliente nuevo antes de diseñar su plan (objetivos, lesiones,
 * alergias…).
 *
 * - Como el post-entreno, la plantilla del tenant ES la configuración (sin
 *   copia por cliente) y `form_templates.is_active` es el interruptor.
 * - UNA respuesta por cliente (índice único parcial en form_responses): el
 *   cliente la envía una vez y, si la vuelve a abrir, edita esa misma fila.
 */

export const INTAKE_FORM_TEMPLATE_NAME = "Formulario inicial";

const yesDetail = (
  id: string,
  parent: string,
  label: string,
  fullQuestion: string,
  pageId: string
): QuestionConfig => ({
  id,
  label,
  fullQuestion,
  icon: "solar:pen-new-square-bold",
  type: "text",
  enabled: true,
  required: true,
  conditionalOn: parent,
  conditionalValue: true,
  pageId,
});

export const DEFAULT_INTAKE_CONFIG: FormConfigData = {
  pages: [
    {
      id: "intake_about",
      title: "Sobre ti",
      icon: "solar:user-rounded-bold",
      order: 0,
    },
    {
      id: "intake_health",
      title: "Salud",
      icon: "solar:health-bold",
      order: 1,
    },
    {
      id: "intake_food",
      title: "Alimentación",
      icon: "solar:plate-bold",
      order: 2,
    },
  ],
  questions: [
    {
      id: "intake_goal",
      label: "Objetivo principal",
      fullQuestion: "¿Cuál es tu objetivo principal?",
      icon: "solar:target-bold",
      type: "multi_choice",
      choices: [
        { id: "perder_grasa", label: "Perder grasa" },
        { id: "ganar_musculo", label: "Ganar músculo" },
        { id: "rendimiento", label: "Mejorar el rendimiento" },
        { id: "salud", label: "Salud y bienestar general" },
      ],
      enabled: true,
      required: true,
      pageId: "intake_about",
    },
    {
      id: "intake_goal_detail",
      label: "Más sobre tu objetivo",
      fullQuestion: "Cuéntame un poco más sobre lo que quieres conseguir",
      icon: "solar:pen-new-square-bold",
      type: "text",
      enabled: true,
      required: false,
      pageId: "intake_about",
    },
    {
      id: "intake_experience",
      label: "Experiencia entrenando",
      fullQuestion: "¿Cuánta experiencia tienes entrenando?",
      icon: "solar:dumbbell-large-minimalistic-bold",
      type: "choice",
      choices: [
        { id: "ninguna", label: "Ninguna" },
        { id: "menos_1", label: "Menos de 1 año" },
        { id: "1_3", label: "Entre 1 y 3 años" },
        { id: "mas_3", label: "Más de 3 años" },
      ],
      enabled: true,
      required: true,
      pageId: "intake_about",
    },
    {
      id: "intake_days",
      label: "Días disponibles",
      fullQuestion: "¿Cuántos días a la semana puedes entrenar?",
      icon: "solar:calendar-bold",
      type: "number",
      unit: "días",
      min: 1,
      max: 7,
      enabled: true,
      required: true,
      pageId: "intake_about",
    },
    {
      id: "intake_injuries",
      label: "Lesiones",
      fullQuestion: "¿Tienes alguna lesión o molestia, actual o pasada?",
      icon: "solar:medical-kit-bold",
      type: "boolean",
      enabled: true,
      required: true,
      pageId: "intake_health",
    },
    yesDetail(
      "intake_injuries_detail",
      "intake_injuries",
      "Detalle de lesiones",
      "¿Cuál o cuáles, y desde cuándo?",
      "intake_health"
    ),
    {
      id: "intake_medical",
      label: "Condiciones médicas",
      fullQuestion:
        "¿Alguna condición médica o medicación que deba conocer? Si no, déjalo en blanco",
      icon: "solar:health-bold",
      type: "text",
      enabled: true,
      required: false,
      pageId: "intake_health",
    },
    {
      id: "intake_allergies",
      label: "Alergias o intolerancias",
      fullQuestion: "¿Tienes alergias o intolerancias alimentarias?",
      icon: "solar:danger-triangle-bold",
      type: "boolean",
      enabled: true,
      required: true,
      pageId: "intake_food",
    },
    yesDetail(
      "intake_allergies_detail",
      "intake_allergies",
      "Detalle de alergias",
      "¿A qué alimentos?",
      "intake_food"
    ),
    {
      id: "intake_dislikes",
      label: "Alimentos que no tomas",
      fullQuestion: "¿Hay alimentos que no te gusten o que no comas?",
      icon: "solar:plate-bold",
      type: "text",
      enabled: true,
      required: false,
      pageId: "intake_food",
    },
    {
      id: "intake_meals",
      label: "Comidas al día",
      fullQuestion: "¿Cuántas comidas sueles hacer al día?",
      icon: "solar:clock-circle-bold",
      type: "number",
      min: 1,
      max: 10,
      enabled: true,
      required: false,
      pageId: "intake_food",
    },
  ],
};
