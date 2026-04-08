/**
 * Normalizes `form_responses.answers` from API/DB for safe UI use.
 * Handles JSON strings and non-object edge cases.
 */
export function normalizeFormAnswers(raw: unknown): Record<string, unknown> {
  if (raw == null) {
    return {};
  }
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as unknown;

      if (
        parsed !== null &&
        typeof parsed === "object" &&
        !Array.isArray(parsed)
      ) {
        return parsed as Record<string, unknown>;
      }

      return {};
    } catch {
      return {};
    }
  }
  if (typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }

  return {};
}

/** Count top-level answer keys after normalization (for list badges). */
export function countAnswerKeys(raw: unknown): number {
  return Object.keys(normalizeFormAnswers(raw)).length;
}
