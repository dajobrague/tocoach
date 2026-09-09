import type { FolderService } from "./folder-service";

import { NextRequest, NextResponse } from "next/server";

import { FolderConflictError, FolderValidationError } from "./folder-service";

export type FolderGuard =
  | { ok: true; tenantHost: string }
  | { ok: false; response: NextResponse };

export interface FolderRoutesConfig {
  /** Auth (+ any feature gate) → the tenant host folders are scoped to. */
  guard: () => Promise<FolderGuard>;
  createService: () => FolderService;
  /** Console prefix ("[RecipeFolders]"). */
  logTag: string;
}

interface RouteContext {
  params: Promise<{ folderId: string }>;
}

function fail(status: number, error: string): NextResponse {
  return NextResponse.json({ success: false, error }, { status });
}

function mapError(error: unknown, logTag: string, op: string): NextResponse {
  if (error instanceof FolderValidationError) return fail(400, error.message);
  if (error instanceof FolderConflictError) return fail(409, error.message);
  console.error(`${logTag} ${op} error:`, error);

  return fail(500, "Internal server error");
}

/**
 * The four folder handlers for one library. `route.ts` exports GET/POST;
 * `[folderId]/route.ts` exports PATCH/DELETE. Flat rows go out — the client
 * builds the tree.
 */
export function createFolderRouteHandlers(config: FolderRoutesConfig) {
  async function GET() {
    const guard = await config.guard();

    if (guard.ok === false) return guard.response;

    try {
      const folders = await config.createService().list(guard.tenantHost);

      return NextResponse.json({ success: true, data: folders });
    } catch (error) {
      return mapError(error, config.logTag, "list");
    }
  }

  async function POST(request: NextRequest) {
    const guard = await config.guard();

    if (guard.ok === false) return guard.response;

    try {
      const body = await request.json().catch(() => null);
      const name = typeof body?.name === "string" ? body.name : "";
      const parentId =
        typeof body?.parent_id === "string" ? body.parent_id : null;
      const folder = await config
        .createService()
        .create(guard.tenantHost, { name, parentId });

      return NextResponse.json(
        { success: true, data: folder },
        { status: 201 }
      );
    } catch (error) {
      return mapError(error, config.logTag, "create");
    }
  }

  // Rename and/or move (parent_id; null = root, cycles rejected). Items are
  // never touched: they reference the folder by id.
  async function PATCH(request: NextRequest, context: RouteContext) {
    const guard = await config.guard();

    if (guard.ok === false) return guard.response;

    try {
      const { folderId } = await context.params;
      const body = await request.json().catch(() => null);
      const patch: { name?: string; parentId?: string | null } = {};

      if (typeof body?.name === "string") patch.name = body.name;
      if (body?.parent_id === null || typeof body?.parent_id === "string") {
        patch.parentId = body.parent_id;
      }

      const folder = await config
        .createService()
        .update(guard.tenantHost, folderId, patch);

      if (folder === null) return fail(404, "Carpeta no encontrada");

      return NextResponse.json({ success: true, data: folder });
    } catch (error) {
      return mapError(error, config.logTag, "update");
    }
  }

  // Remove the folder: children and its items float to the root (FKs).
  async function DELETE(_request: NextRequest, context: RouteContext) {
    const guard = await config.guard();

    if (guard.ok === false) return guard.response;

    try {
      const { folderId } = await context.params;
      const removed = await config
        .createService()
        .remove(guard.tenantHost, folderId);

      if (removed === false) return fail(404, "Carpeta no encontrada");

      return NextResponse.json({ success: true });
    } catch (error) {
      return mapError(error, config.logTag, "delete");
    }
  }

  return { GET, POST, PATCH, DELETE };
}
