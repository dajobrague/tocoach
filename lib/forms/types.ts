// Types for the dynamic forms system

export type QuestionType =
  | "rating"
  | "number"
  | "text"
  | "boolean"
  | "photo"
  | "group";
export type FormType = "checkins" | "habits";

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
}

export interface FormTemplate {
  id: string;
  tenant_host: string;
  form_type: FormType;
  name: string;
  description?: string;
  questions_config: QuestionConfig[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ClientFormConfig {
  id: string;
  tenant_host: string;
  client_id: number;
  form_type: FormType;
  questions_config: QuestionConfig[];
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
