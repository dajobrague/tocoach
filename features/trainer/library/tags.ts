// Tag helpers shared by every trainer library (recipes, exercises, program
// templates). Tag names are compared case-insensitively; which tags exist is
// the tenant's registry (`library_tags`, see use-library-tags.ts). Folders
// are a separate axis (`folder_id`, see folder-tree.ts).

/** Case- and whitespace-insensitive tag key. */
export function normalizeTag(value: string): string {
  return value.trim().toLowerCase();
}

/** Does the list carry `tag` (case-insensitive)? */
export function hasTag(tags: readonly string[], tag: string): boolean {
  const wanted = normalizeTag(tag);

  return tags.some((candidate) => normalizeTag(candidate) === wanted);
}

/** Items carrying EVERY given tag (case-insensitive); no tags = no filter.
 *  Composes with a folder view as "folder AND tags". */
export function filterByTags<T>(
  items: T[],
  tags: string[],
  tagsOf: (item: T) => readonly string[]
): T[] {
  return items.filter((item) => tags.every((tag) => hasTag(tagsOf(item), tag)));
}

/**
 * Predictive tag input: registry tags containing `text` (minus the ones
 * already selected) and, when no existing tag equals the text, the trimmed
 * text as the name Enter would create — null otherwise.
 */
export function tagSuggestions(
  existing: string[],
  selected: string[],
  text: string
): { matches: string[]; create: string | null } {
  const trimmed = text.trim();
  const needle = trimmed.toLowerCase();
  const taken = new Set(selected.map((tag) => tag.toLowerCase()));
  const matches = existing.filter(
    (tag) =>
      taken.has(tag.toLowerCase()) === false &&
      tag.toLowerCase().includes(needle)
  );
  const known =
    taken.has(needle) || existing.some((tag) => tag.toLowerCase() === needle);

  return { matches, create: needle.length > 0 && !known ? trimmed : null };
}
