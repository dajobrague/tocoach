import type { SupabaseClient } from "@supabase/supabase-js";

const FOLDERS_TABLE = "recipe_folders";
const RECIPES_TABLE = "recipes";

export interface RecipeFolderRow {
  id: string;
  tenant_host: string;
  name: string;
  parent_id: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

export class RecipeFolderValidationError extends Error {}
export class RecipeFolderConflictError extends Error {}

/**
 * CRUD for the recipe-folder hierarchy. A folder IS a tag: membership stays
 * on recipes.meal_type_tags, so this service only manages the tree — plus
 * the one coupling point, rename, which bulk-retags the tenant's recipes so
 * the folder and its recipes never drift apart.
 */
export class RecipeFolderService {
  constructor(private readonly client: SupabaseClient) {}

  async list(tenantHost: string): Promise<RecipeFolderRow[]> {
    const { data, error } = await this.client
      .from(FOLDERS_TABLE)
      .select("*")
      .eq("tenant_host", tenantHost)
      .order("position", { ascending: true })
      .order("name", { ascending: true });

    if (error !== null) {
      throw new Error(`RecipeFolderService.list failed: ${error.message}`);
    }

    return (data ?? []) as RecipeFolderRow[];
  }

  async create(
    tenantHost: string,
    input: { name: string; parentId?: string | null }
  ): Promise<RecipeFolderRow> {
    const name = input.name.trim();

    if (name.length === 0) {
      throw new RecipeFolderValidationError("El nombre es obligatorio");
    }

    const parentId = input.parentId ?? null;

    if (parentId !== null) {
      const parent = await this.getById(tenantHost, parentId);

      if (parent === null) {
        throw new RecipeFolderValidationError("Carpeta padre no encontrada");
      }
    }

    const { data, error } = await this.client
      .from(FOLDERS_TABLE)
      .insert({ tenant_host: tenantHost, name, parent_id: parentId })
      .select()
      .single();

    if (error !== null) {
      // 23505 = unique_violation (one folder per tag name per tenant).
      if (error.code === "23505") {
        throw new RecipeFolderConflictError(
          "Ya existe una carpeta con ese nombre"
        );
      }
      throw new Error(`RecipeFolderService.create failed: ${error.message}`);
    }

    return data as RecipeFolderRow;
  }

  /**
   * Rename and/or move a folder. Rename bulk-retags every recipe carrying
   * the old tag; move validates against cycles (a folder can't become a
   * descendant of itself). `parentId: null` moves to the root.
   */
  async update(
    tenantHost: string,
    folderId: string,
    patch: { name?: string; parentId?: string | null }
  ): Promise<RecipeFolderRow | null> {
    const folder = await this.getById(tenantHost, folderId);

    if (folder === null) {
      return null;
    }

    const updates: Record<string, unknown> = {};

    if (patch.name !== undefined) {
      const name = patch.name.trim();

      if (name.length === 0) {
        throw new RecipeFolderValidationError("El nombre es obligatorio");
      }
      updates.name = name;
    }

    if (patch.parentId !== undefined) {
      if (patch.parentId !== null) {
        const parent = await this.getById(tenantHost, patch.parentId);

        if (parent === null) {
          throw new RecipeFolderValidationError("Carpeta padre no encontrada");
        }

        if (
          patch.parentId === folderId ||
          (await this.isDescendant(tenantHost, patch.parentId, folderId))
        ) {
          throw new RecipeFolderValidationError(
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
      .from(FOLDERS_TABLE)
      .update(updates)
      .eq("tenant_host", tenantHost)
      .eq("id", folderId)
      .select()
      .single();

    if (error !== null) {
      if (error.code === "23505") {
        throw new RecipeFolderConflictError(
          "Ya existe una carpeta con ese nombre"
        );
      }
      throw new Error(`RecipeFolderService.update failed: ${error.message}`);
    }

    // Rename → retag: the folder IS the tag, so recipes must follow. Done
    // after the folder update; a failure here surfaces as a 500 and the next
    // rename attempt re-runs the retag (array_replace is idempotent).
    const newName = updates.name as string | undefined;

    if (newName !== undefined && newName !== folder.name) {
      const { error: retagError } = await this.client.rpc(
        "replace_recipe_tag",
        {
          p_tenant_host: tenantHost,
          p_old_tag: folder.name,
          p_new_tag: newName,
        }
      );

      if (retagError !== null) {
        throw new Error(
          `RecipeFolderService.update retag failed: ${retagError.message}`
        );
      }
    }

    return data as RecipeFolderRow;
  }

  /** Delete a folder: children float to the root (FK ON DELETE SET NULL)
   *  and recipes keep the tag, which shows up again as a loose tag. */
  async remove(tenantHost: string, folderId: string): Promise<boolean> {
    const { data, error } = await this.client
      .from(FOLDERS_TABLE)
      .delete()
      .eq("tenant_host", tenantHost)
      .eq("id", folderId)
      .select("id");

    if (error !== null) {
      throw new Error(`RecipeFolderService.remove failed: ${error.message}`);
    }

    return (data ?? []).length > 0;
  }

  private async getById(
    tenantHost: string,
    folderId: string
  ): Promise<RecipeFolderRow | null> {
    const { data, error } = await this.client
      .from(FOLDERS_TABLE)
      .select("*")
      .eq("tenant_host", tenantHost)
      .eq("id", folderId)
      .maybeSingle();

    if (error !== null) {
      throw new Error(`RecipeFolderService.getById failed: ${error.message}`);
    }

    return (data as RecipeFolderRow | null) ?? null;
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
