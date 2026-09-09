import type { SupabaseClient } from "@supabase/supabase-js";

import { MAX_TAG_LENGTH } from "./parse-tags";

export const LIBRARY_TAG_KINDS = ["recipe", "exercise", "program"] as const;

/** Which library a tag belongs to; each has its own registry per tenant. */
export type LibraryTagKind = (typeof LIBRARY_TAG_KINDS)[number];

export function isLibraryTagKind(value: unknown): value is LibraryTagKind {
  return (
    typeof value === "string" &&
    (LIBRARY_TAG_KINDS as readonly string[]).includes(value)
  );
}

/** A `library_tags` row. */
export interface LibraryTagRow {
  id: string;
  tenant_host: string;
  kind: LibraryTagKind;
  name: string;
  created_at: string;
}

/** A registry entry plus how many items of the tenant carry it. */
export interface LibraryTagUsage {
  id: string;
  name: string;
  created_at: string;
  usage: number;
}

export class TagValidationError extends Error {}
export class TagConflictError extends Error {}

/** Trim + bounds — the same rules `parseTags` applies to item tag lists. */
export function parseTagName(value: unknown): string {
  const name = typeof value === "string" ? value.trim() : "";

  if (name.length === 0) {
    throw new TagValidationError("El nombre es obligatorio");
  }

  if (name.length > MAX_TAG_LENGTH) {
    throw new TagValidationError(
      `Etiqueta demasiado larga (máx. ${MAX_TAG_LENGTH} caracteres)`
    );
  }

  return name;
}

/** SQL function that renames (or, with NULL, removes) a tag on every item
 *  of the kind in the tenant — the one coupling point with item arrays. */
const RETAG_RPC: Record<LibraryTagKind, string> = {
  recipe: "replace_recipe_tag",
  program: "replace_program_tag",
  exercise: "replace_exercise_tag",
};

const TABLE = "library_tags";

/**
 * The tag registry of one tenant. Items keep tag NAMES in their arrays
 * (filters stay `@>`); this registry is the source of truth for which tags
 * exist, so a tag survives having no items and never implies a folder.
 * Every query filters on tenant_host — that is the isolation.
 */
export class TagService {
  constructor(private readonly client: SupabaseClient) {}

  private fail(operation: string, message: string): never {
    throw new Error(`TagService.${operation} failed: ${message}`);
  }

  /** Registry entries with usage counts, alphabetical (one RPC). */
  async list(
    tenantHost: string,
    kind: LibraryTagKind
  ): Promise<LibraryTagUsage[]> {
    const { data, error } = await this.client.rpc("library_tags_with_usage", {
      p_tenant_host: tenantHost,
      p_kind: kind,
    });

    if (error !== null) this.fail("list", error.message);

    return ((data ?? []) as LibraryTagUsage[]).map((row) => ({
      ...row,
      usage: Number(row.usage),
    }));
  }

  /**
   * Create a tag. Idempotent on the name (case-insensitive): a second
   * create returns the existing row with `created: false`, so the inline
   * "type + Enter" path never fails on a race with the suggestions.
   */
  async create(
    tenantHost: string,
    kind: LibraryTagKind,
    rawName: unknown
  ): Promise<{ tag: LibraryTagRow; created: boolean }> {
    const name = parseTagName(rawName);
    const { data, error } = await this.client
      .from(TABLE)
      .insert({ tenant_host: tenantHost, kind, name })
      .select()
      .single();

    if (error === null) {
      return { tag: data as LibraryTagRow, created: true };
    }

    // 23505 = unique_violation on (tenant_host, kind, lower(name)).
    if (error.code !== "23505") this.fail("create", error.message);

    const existing = await this.findByName(tenantHost, kind, name);

    if (existing === null) this.fail("create", "conflict without a row");

    return { tag: existing, created: false };
  }

  /** Rename in the registry, then on every item (case-insensitive). */
  async rename(
    tenantHost: string,
    tagId: string,
    rawName: unknown
  ): Promise<LibraryTagRow | null> {
    const name = parseTagName(rawName);
    const tag = await this.getById(tenantHost, tagId);

    if (tag === null) return null;
    if (tag.name === name) return tag;

    const { data, error } = await this.client
      .from(TABLE)
      .update({ name })
      .eq("tenant_host", tenantHost)
      .eq("id", tagId)
      .select()
      .single();

    if (error !== null) {
      if (error.code === "23505") {
        throw new TagConflictError("Ya existe una etiqueta con ese nombre");
      }
      this.fail("rename", error.message);
    }

    await this.retag(tag, name);

    return data as LibraryTagRow;
  }

  /** Delete from the registry and strip it from every item. */
  async remove(tenantHost: string, tagId: string): Promise<boolean> {
    const tag = await this.getById(tenantHost, tagId);

    if (tag === null) return false;

    const { error } = await this.client
      .from(TABLE)
      .delete()
      .eq("tenant_host", tenantHost)
      .eq("id", tagId);

    if (error !== null) this.fail("remove", error.message);

    await this.retag(tag, null);

    return true;
  }

  /** Register any of `names` the registry does not know yet (one RPC). For
   *  write paths that receive tags from elsewhere, e.g. community imports. */
  async ensure(
    tenantHost: string,
    kind: LibraryTagKind,
    names: string[]
  ): Promise<void> {
    if (names.length === 0) return;

    const { error } = await this.client.rpc("library_ensure_tags", {
      p_tenant_host: tenantHost,
      p_kind: kind,
      p_names: names,
    });

    if (error !== null) this.fail("ensure", error.message);
  }

  private async retag(tag: LibraryTagRow, newName: string | null) {
    const { error } = await this.client.rpc(RETAG_RPC[tag.kind], {
      p_tenant_host: tag.tenant_host,
      p_old_tag: tag.name,
      p_new_tag: newName,
    });

    if (error !== null) this.fail("retag", error.message);
  }

  private async getById(
    tenantHost: string,
    tagId: string
  ): Promise<LibraryTagRow | null> {
    const { data, error } = await this.client
      .from(TABLE)
      .select("*")
      .eq("tenant_host", tenantHost)
      .eq("id", tagId)
      .maybeSingle();

    if (error !== null) this.fail("getById", error.message);

    return (data as LibraryTagRow | null) ?? null;
  }

  private async findByName(
    tenantHost: string,
    kind: LibraryTagKind,
    name: string
  ): Promise<LibraryTagRow | null> {
    const { data, error } = await this.client
      .from(TABLE)
      .select("*")
      .eq("tenant_host", tenantHost)
      .eq("kind", kind);

    if (error !== null) this.fail("findByName", error.message);

    const wanted = name.toLowerCase();

    return (
      ((data ?? []) as LibraryTagRow[]).find(
        (row) => row.name.toLowerCase() === wanted
      ) ?? null
    );
  }
}
