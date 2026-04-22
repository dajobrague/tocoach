// Validation functions for the dynamic forms system

import { shouldShowQuestion as sharedShouldShowQuestion } from "./conditional";
import {
  FormConfigData,
  FormResponseSubmission,
  QuestionConfig,
  ValidationError,
  ValidationResult,
  isStructuredConfig,
} from "./types";

/**
 * Validates a question configuration object
 */
export function validateQuestionConfig(question: any): ValidationResult {
  const errors: ValidationError[] = [];

  // Required fields
  if (!question.id || typeof question.id !== "string") {
    errors.push({
      field: "id",
      message: "Question ID is required and must be a string",
    });
  }

  if (!question.label || typeof question.label !== "string") {
    errors.push({
      field: "label",
      message: "Question label is required and must be a string",
    });
  }

  if (!question.icon || typeof question.icon !== "string") {
    errors.push({
      field: "icon",
      message: "Question icon is required and must be a string",
    });
  }

  // Type validation
  const validTypes = [
    "rating",
    "number",
    "text",
    "boolean",
    "photo",
    "group",
    "choice",
    "multi_choice",
  ];

  if (!question.type || !validTypes.includes(question.type)) {
    errors.push({
      field: "type",
      message: `Question type must be one of: ${validTypes.join(", ")}`,
    });
  }

  // Boolean fields
  if (typeof question.enabled !== "boolean") {
    errors.push({
      field: "enabled",
      message: "Question enabled must be a boolean",
    });
  }

  if (typeof question.required !== "boolean") {
    errors.push({
      field: "required",
      message: "Question required must be a boolean",
    });
  }

  // Conditional logic validation
  if (question.conditionalOn) {
    if (typeof question.conditionalOn !== "string") {
      errors.push({
        field: "conditionalOn",
        message: "conditionalOn must be a string (question ID)",
      });
    }
    if (question.conditionalValue === undefined) {
      errors.push({
        field: "conditionalValue",
        message: "conditionalValue is required when conditionalOn is set",
      });
    }
  }

  // Group type validation
  if (question.type === "group") {
    if (
      !Array.isArray(question.subQuestions) ||
      question.subQuestions.length === 0
    ) {
      errors.push({
        field: "subQuestions",
        message: "Group type questions must have at least one subQuestion",
      });
    } else {
      // Validate each sub-question recursively
      question.subQuestions.forEach((subQ: any, index: number) => {
        const subResult = validateQuestionConfig(subQ);

        if (!subResult.valid) {
          subResult.errors.forEach((err) => {
            errors.push({
              field: `subQuestions[${index}].${err.field}`,
              message: err.message,
            });
          });
        }
      });
    }
  }

  // Choice / multi_choice: exigir `choices` con mínimo 2 opciones,
  // cada una con id + label no vacíos, ids únicos dentro de la pregunta.
  if (question.type === "choice" || question.type === "multi_choice") {
    if (!Array.isArray(question.choices)) {
      errors.push({
        field: "choices",
        message:
          "Las preguntas de opciones requieren un array `choices` con al menos 2 elementos",
      });
    } else if (question.choices.length < 2) {
      errors.push({
        field: "choices",
        message:
          "Las preguntas de opciones deben tener al menos 2 opciones configuradas",
      });
    } else {
      const seenIds = new Set<string>();

      question.choices.forEach((choice: any, index: number) => {
        if (!choice || typeof choice !== "object") {
          errors.push({
            field: `choices[${index}]`,
            message: "Cada opción debe ser un objeto { id, label }",
          });

          return;
        }
        if (!choice.id || typeof choice.id !== "string") {
          errors.push({
            field: `choices[${index}].id`,
            message: "El id de la opción es obligatorio y debe ser string",
          });
        } else if (seenIds.has(choice.id)) {
          errors.push({
            field: `choices[${index}].id`,
            message: `Id duplicado en opciones: ${choice.id}`,
          });
        } else {
          seenIds.add(choice.id);
        }
        if (!choice.label || typeof choice.label !== "string") {
          errors.push({
            field: `choices[${index}].label`,
            message: "El label de la opción es obligatorio y debe ser string",
          });
        }
        if (choice.icon !== undefined && typeof choice.icon !== "string") {
          errors.push({
            field: `choices[${index}].icon`,
            message: "El icono de la opción debe ser string (nombre iconify)",
          });
        }
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validates an array of question configurations or the new structured format.
 * Accepts both legacy QuestionConfig[] and new { pages, questions } format.
 */
export function validateQuestionsConfig(config: any): ValidationResult {
  const errors: ValidationError[] = [];

  // Determine which format we're dealing with
  let questions: any[];

  if (
    config &&
    typeof config === "object" &&
    !Array.isArray(config) &&
    "pages" in config &&
    "questions" in config
  ) {
    // New structured format: { pages: FormPage[], questions: QuestionConfig[] }
    if (!Array.isArray(config.pages)) {
      return {
        valid: false,
        errors: [{ field: "pages", message: "Pages must be an array" }],
      };
    }
    if (!Array.isArray(config.questions)) {
      return {
        valid: false,
        errors: [{ field: "questions", message: "Questions must be an array" }],
      };
    }
    questions = config.questions;
  } else if (Array.isArray(config)) {
    // Legacy format: plain array
    questions = config;
  } else {
    return {
      valid: false,
      errors: [
        {
          field: "questions",
          message:
            "Questions config must be an array or an object with { pages, questions }",
        },
      ],
    };
  }

  const questionIds = new Set<string>();

  questions.forEach((question, index) => {
    // Check for duplicate IDs
    if (questionIds.has(question.id)) {
      errors.push({
        field: `questions[${index}].id`,
        message: `Duplicate question ID: ${question.id}`,
      });
    }
    questionIds.add(question.id);

    // Validate individual question
    const result = validateQuestionConfig(question);

    if (!result.valid) {
      result.errors.forEach((err) => {
        errors.push({
          field: `questions[${index}].${err.field}`,
          message: err.message,
        });
      });
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Gets all enabled questions (including enabled subQuestions)
 */
export function getEnabledQuestions(
  questions: QuestionConfig[]
): QuestionConfig[] {
  const enabled: QuestionConfig[] = [];

  questions.forEach((question) => {
    if (question.enabled) {
      if (question.type === "group" && question.subQuestions) {
        // For groups, include the group with only enabled sub-questions
        const enabledSubs = question.subQuestions.filter((sq) => sq.enabled);

        if (enabledSubs.length > 0) {
          enabled.push({
            ...question,
            subQuestions: enabledSubs,
          });
        }
      } else {
        enabled.push(question);
      }
    }
  });

  return enabled;
}

/**
 * Checks if a question should be visible based on conditional logic.
 *
 * La implementación real vive en `lib/forms/conditional.ts` — este re-export
 * se mantiene para no romper los imports existentes.
 */
export function shouldShowQuestion(
  question: QuestionConfig,
  answers: Record<string, any>
): boolean {
  return sharedShouldShowQuestion(question, answers);
}

/**
 * Determina si el answer del cliente cuenta como "vacío" para el propósito
 * del required check. Un array vacío cuenta como vacío SOLO para `multi_choice`
 * (el resto de tipos no usan arrays como valor).
 */
export function isEmptyAnswer(
  type: QuestionConfig["type"],
  answer: unknown
): boolean {
  if (answer === undefined || answer === null || answer === "") {
    return true;
  }
  if (type === "multi_choice" && Array.isArray(answer) && answer.length === 0) {
    return true;
  }

  return false;
}

function pushAnswerTypeErrors(
  question: QuestionConfig,
  answer: unknown,
  errors: ValidationError[]
): void {
  const fieldId = question.id;
  const label = question.label;

  if (isEmptyAnswer(question.type, answer)) {
    return;
  }

  switch (question.type) {
    case "rating":
      if (typeof answer !== "number" || answer < 1 || answer > 5) {
        errors.push({
          field: fieldId,
          message: `${label} debe ser un número entre 1 y 5`,
        });
      }
      break;

    case "number":
      if (typeof answer !== "number" || isNaN(answer)) {
        errors.push({
          field: fieldId,
          message: `${label} debe ser un número válido`,
        });
      }
      break;

    case "boolean":
      if (typeof answer !== "boolean") {
        errors.push({
          field: fieldId,
          message: `${label} debe ser verdadero o falso`,
        });
      }
      break;

    case "text":
      if (typeof answer !== "string") {
        errors.push({
          field: fieldId,
          message: `${label} debe ser texto`,
        });
      }
      break;

    case "photo":
      if (typeof answer !== "string") {
        errors.push({
          field: fieldId,
          message: `${label} debe ser una URL o texto de imagen`,
        });
      }
      break;

    case "choice": {
      if (typeof answer !== "string") {
        errors.push({
          field: fieldId,
          message: `${label} debe ser el id de una de las opciones`,
        });
        break;
      }
      const validIds = new Set((question.choices ?? []).map((c) => c.id));

      if (!validIds.has(answer)) {
        errors.push({
          field: fieldId,
          message: `${label}: la opción seleccionada no existe en la configuración`,
        });
      }
      break;
    }

    case "multi_choice": {
      if (!Array.isArray(answer)) {
        errors.push({
          field: fieldId,
          message: `${label} debe ser un array de ids de opciones`,
        });
        break;
      }
      const validIds = new Set((question.choices ?? []).map((c) => c.id));

      answer.forEach((item, index) => {
        if (typeof item !== "string") {
          errors.push({
            field: `${fieldId}[${index}]`,
            message: `${label}: cada elemento debe ser un id string`,
          });

          return;
        }
        if (!validIds.has(item)) {
          errors.push({
            field: `${fieldId}[${index}]`,
            message: `${label}: la opción "${item}" no existe en la configuración`,
          });
        }
      });
      break;
    }

    case "group":
      break;

    default:
      break;
  }
}

/**
 * Validates a form response against its configuration.
 * Accepts both legacy flat arrays and structured { pages, questions } configs.
 */
export function validateFormResponse(
  submission: FormResponseSubmission,
  config: QuestionConfig[] | FormConfigData
): ValidationResult {
  const errors: ValidationError[] = [];
  const { answers } = submission;

  // Normalize: extract the questions array from either format
  const questionsArray: QuestionConfig[] = isStructuredConfig(config)
    ? config.questions
    : Array.isArray(config)
      ? config
      : [];

  // Get only enabled questions
  const enabledQuestions = getEnabledQuestions(questionsArray);

  enabledQuestions.forEach((question) => {
    if (!shouldShowQuestion(question, answers)) {
      return;
    }

    if (question.type === "group") {
      if (question.subQuestions) {
        question.subQuestions.forEach((subQ) => {
          if (!shouldShowQuestion(subQ, answers)) {
            return;
          }

          if (subQ.required && isEmptyAnswer(subQ.type, answers[subQ.id])) {
            errors.push({
              field: subQ.id,
              message: `${subQ.label} es obligatorio`,
            });
          }

          pushAnswerTypeErrors(subQ, answers[subQ.id], errors);
        });
      }

      return;
    }

    if (
      question.required &&
      isEmptyAnswer(question.type, answers[question.id])
    ) {
      errors.push({
        field: question.id,
        message: `${question.label} es obligatorio`,
      });
    }

    pushAnswerTypeErrors(question, answers[question.id], errors);
  });

  // Check for unexpected fields (answers not in config)
  const validQuestionIds = new Set<string>();

  enabledQuestions.forEach((q) => {
    validQuestionIds.add(q.id);
    if (q.subQuestions) {
      q.subQuestions.forEach((sq) => validQuestionIds.add(sq.id));
    }
  });

  Object.keys(answers).forEach((answerId) => {
    if (!validQuestionIds.has(answerId)) {
      errors.push({
        field: answerId,
        message: `Campo inesperado: ${answerId}`,
      });
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Checks if all required fields are filled
 */
export function checkRequiredFields(
  answers: Record<string, any>,
  config: QuestionConfig[]
): ValidationResult {
  const errors: ValidationError[] = [];
  const enabledQuestions = getEnabledQuestions(config);

  enabledQuestions.forEach((question) => {
    if (!shouldShowQuestion(question, answers)) {
      return;
    }

    if (question.required) {
      const answer = answers[question.id];

      if (answer === undefined || answer === null || answer === "") {
        errors.push({
          field: question.id,
          message: `${question.label} es obligatorio`,
        });
      }
    }

    // Check sub-questions for groups
    if (question.type === "group" && question.subQuestions) {
      question.subQuestions
        .filter((sq) => sq.enabled)
        .forEach((subQ) => {
          if (!shouldShowQuestion(subQ, answers)) {
            return;
          }

          if (subQ.required) {
            const answer = answers[subQ.id];

            if (answer === undefined || answer === null || answer === "") {
              errors.push({
                field: subQ.id,
                message: `${subQ.label} es obligatorio`,
              });
            }
          }
        });
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}
