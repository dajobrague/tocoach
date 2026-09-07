import { parseFolderId } from "@/lib/library/parse-folder";
import { parseTags } from "@/lib/library/parse-tags";

export type TemplateUpdate =
  | { ok: true; updates: Record<string, unknown> }
  | { ok: false; error: string };

/** Body fields that live inside `programs.metadata`. */
const METADATA_FIELDS = [
  "type",
  "category",
  "division",
  "goal",
  "sessionsPerWeek",
] as const;

/**
 * Column updates for PUT /api/templates/[id]. Partial: only the fields
 * present in the body are touched, so a `{ folder_id }` PUT (the folder
 * view's "move to folder") or a tags-only PUT leaves name, description and
 * metadata alone. Any metadata field present rebuilds `metadata` whole —
 * the detail modal has always sent every field, so that path keeps its
 * exact behaviour. Folder ownership is checked by the route.
 */
export function buildTemplateUpdate(body: unknown): TemplateUpdate {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, error: "Cuerpo de la petición inválido" };
  }

  const record = body as Record<string, unknown>;
  const updates: Record<string, unknown> = {};

  if ("name" in record) {
    const name = typeof record.name === "string" ? record.name.trim() : "";

    if (name.length === 0) {
      return { ok: false, error: "El nombre es obligatorio" };
    }
    updates.name = name;
  }

  if ("description" in record) {
    const description = record.description;

    updates.description =
      typeof description === "string" && description.length > 0
        ? description
        : null;
  }

  if (METADATA_FIELDS.some((field) => field in record)) {
    const { type, category, division, goal, sessionsPerWeek } = record;
    const perWeek =
      typeof sessionsPerWeek === "number"
        ? sessionsPerWeek
        : typeof sessionsPerWeek === "string" && sessionsPerWeek !== ""
          ? parseInt(sessionsPerWeek, 10)
          : NaN;
    const metadata: Record<string, unknown> = {
      type: typeof type === "string" && type.length > 0 ? type : "Strength",
      sessions_per_week: Number.isNaN(perWeek) ? 3 : perWeek,
    };

    if (typeof category === "string" && category.length > 0) {
      metadata.category = category;
    }

    if (category === "cardio" && typeof goal === "string" && goal.length > 0) {
      metadata.goal = goal;
    } else if (typeof division === "string" && division.length > 0) {
      metadata.division = division;
    }

    updates.metadata = metadata;
  }

  const parsedTags = parseTags(record.tags);

  if (parsedTags !== undefined) {
    if (parsedTags.ok === false) return parsedTags;
    updates.tags = parsedTags.tags;
  }

  const folder = parseFolderId(record.folder_id);

  if (folder !== undefined) {
    if (folder.ok === false) return folder;
    updates.folder_id = folder.folderId;
  }

  return { ok: true, updates };
}
