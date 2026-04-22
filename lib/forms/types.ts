// Types for the dynamic forms system

export type QuestionType =
  | "rating"
  | "number"
  | "text"
  | "boolean"
  | "photo"
  | "group"
  | "choice"
  | "multi_choice";
export type FormType = "checkins" | "habits";

/**
 * Opción individual para preguntas de tipo `choice` / `multi_choice`.
 *
 * `id` se genera al crear la opción (vía `generateChoiceId`) y es INMUTABLE
 * — el trainer puede renombrar el `label`, pero el `id` es la clave que se
 * guarda en las respuestas históricas y se usa para los matches condicionales.
 * Cambiarlo invalidaría respuestas ya submitted.
 */
export interface ChoiceOption {
  id: string;
  label: string;
  /** Nombre iconify opcional (p.ej. "solar:emoji-funny-circle-bold"). */
  icon?: string;
}

/**
 * Check-in cadence kinds.
 *
 * Canonical values going forward are `"weekly"` (single day per recurrence)
 * and `"custom"` (multiple days per recurrence, `times_per_week === days_of_week.length`).
 *
 * `"biweekly"` is retained as a **legacy alias** for `"weekly"` + `interval_weeks === 2`.
 * Reader code (see `getScheduleOrDefault`) normalises it silently; writers should emit
 * the canonical `"weekly"` form with `interval_weeks` set explicitly.
 */
export type CheckInFrequency = "weekly" | "biweekly" | "custom";

/**
 * Check-in cadence stored in `client_form_configs.schedule` (JSONB).
 * `days_of_week` uses 0 = Sunday through 6 = Saturday (JavaScript convention).
 *
 * `interval_weeks` (default `1`) expresses "every N weeks". Legacy rows with
 * `frequency: "biweekly"` and no `interval_weeks` are normalised at read time
 * to `frequency: "weekly"` + `interval_weeks: 2`.
 */
export interface CheckInSchedule {
  frequency: CheckInFrequency;
  times_per_week: number;
  days_of_week: number[];
  /**
   * Interval, in whole weeks, between recurrences. Defaults to `1` (every week).
   * `2` reproduces the legacy biweekly behaviour. Typical UI range: 1–12.
   */
  interval_weeks: number;
  /** Local wall time in 24h format, e.g. `"12:00"`. */
  time: string;
  /** IANA timezone id, e.g. `"Europe/Madrid"`. */
  timezone: string;
  custom_name: string;
  grace_period_hours: number;
  enabled: boolean;
}

export const DEFAULT_CHECKIN_SCHEDULE: CheckInSchedule = {
  frequency: "weekly",
  times_per_week: 1,
  days_of_week: [1],
  interval_weeks: 1,
  time: "12:00",
  timezone: "Europe/Madrid",
  custom_name: "Check-in",
  grace_period_hours: 48,
  enabled: true,
};

export interface FormPage {
  id: string;
  title: string;
  icon: string; // iconify icon name, e.g. "solar:bolt-bold"
  order: number;
}

export interface QuestionConfig {
  id: string;
  label: string;
  shortLabel?: string;
  fullQuestion?: string;
  icon: string;
  type: QuestionType;
  unit?: string;
  enabled: boolean;
  required: boolean;
  conditionalOn?: string;
  /**
   * Valor que el answer del parent debe igualar (o contener, para
   * `multi_choice`) para que esta pregunta sea visible. El tipo string
   * existe para soportar `choice` (igualdad exacta del id) y `multi_choice`
   * (includes sobre el array).
   */
  conditionalValue?: boolean | number | string;
  subQuestions?: QuestionConfig[];
  pageId?: string; // which page this question belongs to
  /**
   * Opciones disponibles — obligatorio (≥2) cuando `type` es `choice` o
   * `multi_choice`. Ignorado para el resto de tipos.
   */
  choices?: ChoiceOption[];
}

/**
 * New structured format for questions_config JSONB.
 * Legacy configs are plain QuestionConfig[], new configs use this wrapper.
 */
export interface FormConfigData {
  pages: FormPage[];
  questions: QuestionConfig[];
}

/**
 * Type guard: returns true if the config is the new { pages, questions } format.
 */
export function isStructuredConfig(
  config: QuestionConfig[] | FormConfigData
): config is FormConfigData {
  return (
    config !== null &&
    typeof config === "object" &&
    !Array.isArray(config) &&
    "pages" in config &&
    "questions" in config
  );
}

/**
 * ¿Tiene el config una estructura de páginas "real"?
 *
 * Usamos este guard en dos lugares distintos: el renderer del cliente
 * (`dynamic-form-modal.tsx`) y la preview del trainer (`forms-tab.tsx`).
 * Antes cada uno tenía la condición inline (`pages.length > 1 ||
 * (pages.length === 1 && pages[0]?.id !== "default")`) y si alguien
 * modificaba el criterio de "layout estructurado" en un sitio se
 * olvidaba del otro.
 *
 * Regla: el config tiene pages reales si hay más de una página, o si la
 * única página no es la `"default"` auto-generada por `normalizeFormConfig`
 * para configs legacy (array flat).
 */
export function hasStructuredPages(pages: readonly FormPage[]): boolean {
  if (pages.length > 1) return true;
  if (pages.length === 1 && pages[0]?.id !== "default") return true;

  return false;
}

/**
 * Normalize any config format into the structured { pages, questions } shape.
 * Legacy flat arrays become a single default page.
 */
export function normalizeFormConfig(
  raw: QuestionConfig[] | FormConfigData
): FormConfigData {
  if (isStructuredConfig(raw)) {
    return raw;
  }

  // Legacy: flat array → wrap in one default page
  const defaultPage: FormPage = {
    id: "default",
    title: "General",
    icon: "solar:clipboard-check-bold",
    order: 0,
  };

  const questions = (raw as QuestionConfig[]).map((q) => ({
    ...q,
    pageId: q.pageId || "default",
  }));

  return { pages: [defaultPage], questions };
}

export interface FormTemplate {
  id: string;
  tenant_host: string;
  form_type: FormType;
  name: string;
  description?: string;
  questions_config: QuestionConfig[] | FormConfigData;
  is_active: boolean;
  /**
   * When true, newly created clients for this tenant receive a
   * `client_form_configs` row seeded from this template (questions + schedule)
   * at creation time. Does NOT propagate to existing clients — those require
   * an explicit "aplicar plantilla" action from the trainer.
   */
  auto_apply_to_new_clients: boolean;
  default_schedule?: CheckInSchedule | null;
  created_at: string;
  updated_at: string;
}

export interface ClientFormConfig {
  id: string;
  tenant_host: string;
  client_id: number;
  form_type: FormType;
  questions_config: QuestionConfig[] | FormConfigData;
  uses_template: boolean;
  template_id?: string;
  schedule?: CheckInSchedule | null;
  created_at: string;
  updated_at: string;
}

export interface FormResponse {
  id: string;
  tenant_host: string;
  client_id: number;
  form_type: FormType;
  response_date: string;
  answers: Record<string, any>;
  metadata?: Record<string, any>;
  submitted_at: string;
  created_at: string;
  updated_at: string;
}

export interface FormResponseSubmission {
  form_type: FormType;
  response_date: string;
  answers: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}
