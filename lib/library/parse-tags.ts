// Server-side parsing of tag lists (request bodies) and tag filters (query
// strings) for exercises and program templates. Client inputs already trim
// and dedupe; this is the parity check at the trust boundary.

export const MAX_TAGS = 30;
export const MAX_TAG_LENGTH = 40;

export type ParsedTags =
  | { ok: true; tags: string[] }
  | { ok: false; error: string };

/**
 * Validate a `tags` body field: strings only, trimmed, no blanks, one
 * spelling per tag (case-insensitive, first wins). Returns `undefined` when
 * the field is absent so callers leave the column untouched.
 */
export function parseTags(value: unknown): ParsedTags | undefined {
  if (value === undefined) return undefined;

  if (Array.isArray(value) === false) {
    return { ok: false, error: "Las etiquetas deben ser una lista" };
  }

  const tags: string[] = [];
  const seen = new Set<string>();

  for (const raw of value as unknown[]) {
    if (typeof raw !== "string") {
      return { ok: false, error: "Etiqueta inválida" };
    }

    const tag = raw.trim();

    if (tag.length === 0) continue;

    if (tag.length > MAX_TAG_LENGTH) {
      return {
        ok: false,
        error: `Etiqueta demasiado larga (máx. ${MAX_TAG_LENGTH} caracteres)`,
      };
    }

    const key = tag.toLowerCase();

    if (seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
  }

  if (tags.length > MAX_TAGS) {
    return { ok: false, error: `Demasiadas etiquetas (máx. ${MAX_TAGS})` };
  }

  return { ok: true, tags };
}

/** Repeatable `?tag=a&tag=b` filter: the item must carry both. */
export function parseTagParams(params: URLSearchParams): string[] {
  return params
    .getAll("tag")
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0 && tag.length <= MAX_TAG_LENGTH);
}
