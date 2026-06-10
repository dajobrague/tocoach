// Rest prescription lives in two places depending on which trainer flow
// wrote the row: the template editor parses numeric input into the
// `session_exercises.rest_seconds` column, while the client-page add/edit
// flow stores the raw text only in `metadata.rest_description`
// (free text like "120s", "2 min" or "El necesario para rendir al 100%").
// Any client-facing render must consult both, with the description winning
// — same precedence as resolveStrengthCoachingFields in training-utils.

/**
 * Resolve the display label for an exercise's rest prescription.
 * Returns "" when neither storage path has a usable value.
 */
export function resolveRestLabel(
  restDescription: string | null | undefined,
  restSeconds: number | null | undefined
): string {
  const desc =
    typeof restDescription === "string" ? restDescription.trim() : "";

  if (desc) return desc;

  if (
    typeof restSeconds === "number" &&
    Number.isFinite(restSeconds) &&
    restSeconds > 0
  ) {
    return `${Math.round(restSeconds)}s`;
  }

  return "";
}
