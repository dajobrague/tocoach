// Validation functions for the dynamic forms system

import {
  FormResponseSubmission,
  QuestionConfig,
  ValidationError,
  ValidationResult,
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
  const validTypes = ["rating", "number", "text", "boolean", "photo", "group"];

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

  // Number type validation
  if (question.type === "number" && !question.unit) {
    errors.push({
      field: "unit",
      message:
        'Number type questions should have a unit (e.g., "kg", "cm", "pasos")',
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validates an array of question configurations
 */
export function validateQuestionsConfig(questions: any[]): ValidationResult {
  const errors: ValidationError[] = [];

  if (!Array.isArray(questions)) {
    return {
      valid: false,
      errors: [
        { field: "questions", message: "Questions config must be an array" },
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
 * Checks if a question should be visible based on conditional logic
 */
export function shouldShowQuestion(
  question: QuestionConfig,
  answers: Record<string, any>
): boolean {
  if (!question.conditionalOn) {
    return true;
  }

  const conditionalAnswer = answers[question.conditionalOn];

  // For boolean conditionals
  if (typeof question.conditionalValue === "boolean") {
    return conditionalAnswer === question.conditionalValue;
  }

  // For numeric conditionals (e.g., rating <= 3)
  if (typeof question.conditionalValue === "number") {
    return conditionalAnswer <= question.conditionalValue;
  }

  // If conditional answer exists (any truthy value)
  return !!conditionalAnswer;
}

/**
 * Validates a form response against its configuration
 */
export function validateFormResponse(
  submission: FormResponseSubmission,
  config: QuestionConfig[]
): ValidationResult {
  const errors: ValidationError[] = [];
  const { answers } = submission;

  // Get only enabled questions
  const enabledQuestions = getEnabledQuestions(config);

  // Check required fields
  enabledQuestions.forEach((question) => {
    // Skip if question is conditional and shouldn't be shown
    if (!shouldShowQuestion(question, answers)) {
      return;
    }

    if (
      question.required &&
      (answers[question.id] === undefined ||
        answers[question.id] === null ||
        answers[question.id] === "")
    ) {
      errors.push({
        field: question.id,
        message: `${question.label} es obligatorio`,
      });
    }

    // Validate type-specific constraints
    if (
      answers[question.id] !== undefined &&
      answers[question.id] !== null &&
      answers[question.id] !== ""
    ) {
      const answer = answers[question.id];

      switch (question.type) {
        case "rating":
          if (typeof answer !== "number" || answer < 1 || answer > 5) {
            errors.push({
              field: question.id,
              message: `${question.label} debe ser un número entre 1 y 5`,
            });
          }
          break;

        case "number":
          if (typeof answer !== "number" || isNaN(answer)) {
            errors.push({
              field: question.id,
              message: `${question.label} debe ser un número válido`,
            });
          }
          break;

        case "boolean":
          if (typeof answer !== "boolean") {
            errors.push({
              field: question.id,
              message: `${question.label} debe ser verdadero o falso`,
            });
          }
          break;

        case "text":
          if (typeof answer !== "string") {
            errors.push({
              field: question.id,
              message: `${question.label} debe ser texto`,
            });
          }
          break;

        case "group":
          // For groups, validate sub-questions
          if (question.subQuestions) {
            question.subQuestions.forEach((subQ) => {
              if (!shouldShowQuestion(subQ, answers)) {
                return;
              }

              if (
                subQ.required &&
                (answers[subQ.id] === undefined ||
                  answers[subQ.id] === null ||
                  answers[subQ.id] === "")
              ) {
                errors.push({
                  field: subQ.id,
                  message: `${subQ.label} es obligatorio`,
                });
              }
            });
          }
          break;
      }
    }
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
