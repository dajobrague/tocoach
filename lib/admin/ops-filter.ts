// `?trainers=<uuid>,<uuid>` for the ops panel. Shared by the API route (which
// rejects garbage with a 400) and the page (which reads the URL state).

export const MAX_OPS_TRAINERS = 50;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type TrainerFilter =
  | { ok: true; ids: string[] | null }
  | { ok: false; error: string };

/** null / empty → all trainers (ids: null). Deduplicated, lower-cased. */
export function parseTrainerFilter(raw: string | null): TrainerFilter {
  const parts = (raw ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  if (parts.length === 0) return { ok: true, ids: null };
  if (!parts.every((p) => UUID.test(p)))
    return { ok: false, error: "Parámetro trainers inválido" };
  const ids = [...new Set(parts)];

  if (ids.length > MAX_OPS_TRAINERS)
    return {
      ok: false,
      error: `Máximo ${MAX_OPS_TRAINERS} entrenadores a la vez`,
    };

  return { ok: true, ids };
}
