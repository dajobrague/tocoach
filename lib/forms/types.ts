// Types for the dynamic forms system

export type QuestionType =
  | "rating"
  | "number"
  | "text"
  | "boolean"
  | "photo"
  | "group";
export type FormType = "checkins" | "habits";

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
  conditionalValue?: boolean | number;
  subQuestions?: QuestionConfig[];
  pageId?: string; // which page this question belongs to
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
