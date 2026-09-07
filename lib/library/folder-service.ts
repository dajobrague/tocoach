import type { SupabaseClient } from "@supabase/supabase-js";

export interface FolderRow {
  id: string;
  tenant_host: string;
  name: string;
  parent_id: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

export class FolderValidationError extends Error {}
export class FolderConflictError extends Error {}

export interface FolderServiceConfig {
  /** Folders table ("recipe_folders", "program_folders"). */
  table: string;
  /** SQL function `(p_tenant_host, p_old_tag, p_new_tag)` that renames the
   *  tag on every item of the tenant — the one coupling point with items. */
  retagRpc: string;
}

/**
 * CRUD for a folder hierarchy. A folder IS a tag: membership stays on the
 * items' tag column, so this service only manages the tree — plus the one
 * coupling point, rename, which bulk-retags the tenant's items so the
 * folder and its items never drift apart. One instance per library.
 */
export class FolderService {
  constructor(
    private readonly client: SupabaseClient,
    private readonly config: FolderServiceConfig
  ) {}

  private fail(operation: string, message: string): never {
    throw new Error(
      `FolderService(${this.config.table}).${operation} failed: ${message}`
    );
  }

  async list(tenantHost: string): Promise<FolderRow[]> {
    const { data, error } = await this.client
      .from(this.config.table)
      .select("*")
      .eq("tenant_host", tenantHost)
      .order("position", { ascending: true })
      .order("name", { ascending: true });

    if (error !== null) this.fail("list", error.message);

    return (data ?? []) as FolderRow[];
  }

  async create(
    tenantHost: string,
    input: { name: string; parentId?: string | null }
  ): Promise<FolderRow> {
    const name = input.name.trim();

    if (name.length === 0) {
      throw new FolderValidationError("El nombre es obligatorio");
    }

    const parentId = input.parentId ?? null;

    if (parentId !== null) {
      const parent = await this.getById(tenantHost, parentId);

      if (parent === null) {
        throw new FolderValidationError("Carpeta padre no encontrada");
      }
    }

    const { data, error } = await this.client
      .from(this.config.table)
      .insert({ tenant_host: tenantHost, name, parent_id: parentId })
      .select()
      .single();

    if (error !== null) {
      // 23505 = unique_violation (one folder per tag name per tenant).
      if (error.code === "23505") {
        throw new FolderConflictError("Ya existe una carpeta con ese nombre");
      }
      this.fail("create", error.message);
    }

    return data as FolderRow;
  }

  /**
   * Rename and/or move a folder. Rename bulk-retags every item carrying
   * the old tag; move validates against cycles (a folder can't become a
   * descendant of itself). `parentId: null` moves to the root.
   */
  async update(
    tenantHost: string,
    folderId: string,
    patch: { name?: string; parentId?: string | null }
  ): Promise<FolderRow | null> {
    const folder = await this.getById(tenantHost, folderId);

    if (folder === null) {
      return null;
    }

    const updates: Record<string, unknown> = {};

    if (patch.name !== undefined) {
      const name = patch.name.trim();

      if (name.length === 0) {
        throw new FolderValidationError("El nombre es obligatorio");
      }
      updates.name = name;
    }

    if (patch.parentId !== undefined) {
      if (patch.parentId !== null) {
        const parent = await this.getById(tenantHost, patch.parentId);

        if (parent === null) {
          throw new FolderValidationError("Carpeta padre no encontrada");
        }

        if (
          patch.parentId === folderId ||
          (await this.isDescendant(tenantHost, patch.parentId, folderId))
        ) {
          throw new FolderValidationError(
            "Una carpeta no puede moverse dentro de sí misma"
          );
        }
      }
      updates.parent_id = patch.parentId;
    }

    if (Object.keys(updates).length === 0) {
      return folder;
    }

    const { data, error } = await this.client
      .from(this.config.table)
      .update(updates)
      .eq("tenant_host", tenantHost)
      .eq("id", folderId)
      .select()
      .single();

    if (error !== null) {
      if (error.code === "23505") {
        throw new FolderConflictError("Ya existe una carpeta con ese nombre");
      }
      this.fail("update", error.message);
    }

    // Rename → retag: the folder IS the tag, so items must follow. Done
    // after the folder update; a failure here surfaces as a 500 and the next
    // rename attempt re-runs the retag (array_replace is idempotent).
    const newName = updates.name as string | undefined;

    if (newName !== undefined && newName !== folder.name) {
      const { error: retagError } = await this.client.rpc(
        this.config.retagRpc,
        {
          p_tenant_host: tenantHost,
          p_old_tag: folder.name,
          p_new_tag: newName,
        }
      );

      if (retagError !== null) {
        this.fail("update retag", retagError.message);
      }
    }

    return data as FolderRow;
  }

  /** Delete a folder: children float to the root (FK ON DELETE SET NULL)
   *  and items keep the tag as a plain, filterable tag. */
  async remove(tenantHost: string, folderId: string): Promise<boolean> {
    const { data, error } = await this.client
      .from(this.config.table)
      .delete()
      .eq("tenant_host", tenantHost)
      .eq("id", folderId)
      .select("id");

    if (error !== null) this.fail("remove", error.message);

    return (data ?? []).length > 0;
  }

  private async getById(
    tenantHost: string,
    folderId: string
  ): Promise<FolderRow | null> {
    const { data, error } = await this.client
      .from(this.config.table)
      .select("*")
      .eq("tenant_host", tenantHost)
      .eq("id", folderId)
      .maybeSingle();

    if (error !== null) this.fail("getById", error.message);

    return (data as FolderRow | null) ?? null;
  }

  /** True when `candidateId` sits anywhere under `ancestorId`. */
  private async isDescendant(
    tenantHost: string,
    candidateId: string,
    ancestorId: string
  ): Promise<boolean> {
    const folders = await this.list(tenantHost);
    const parentById = new Map(
      folders.map((folder) => [folder.id, folder.parent_id])
    );
    let current: string | null | undefined = candidateId;
    // Bounded walk: a corrupt cycle in data must not hang the request.
    let hops = 0;

    while (current != null && hops < 100) {
      if (current === ancestorId) return true;
      current = parentById.get(current);
      hops += 1;
    }

    return false;
  }
}
