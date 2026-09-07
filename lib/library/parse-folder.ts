// Server-side parsing of folder membership: the `?folder=` list filter and
// the `folder_id` body field of recipes and program templates. Ownership
// (the folder belongs to the tenant) is checked by the services.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * `?folder=root` → null (items outside every folder); `?folder=<uuid>` →
 * that id; absent or malformed → undefined (no folder filter).
 */
export function parseFolderParam(
  params: URLSearchParams
): string | null | undefined {
  const value = params.get("folder");

  if (value === null) return undefined;
  if (value === "root") return null;

  return UUID.test(value) ? value : undefined;
}

export type ParsedFolderId =
  | { ok: true; folderId: string | null }
  | { ok: false; error: string };

/**
 * `folder_id` body field: null moves the item to the root, a uuid moves it
 * into that folder. Returns undefined when absent so callers leave the
 * column untouched (the PATCH is partial).
 */
export function parseFolderId(value: unknown): ParsedFolderId | undefined {
  if (value === undefined) return undefined;
  if (value === null) return { ok: true, folderId: null };
  if (typeof value === "string" && UUID.test(value)) {
    return { ok: true, folderId: value };
  }

  return { ok: false, error: "Carpeta inválida" };
}
