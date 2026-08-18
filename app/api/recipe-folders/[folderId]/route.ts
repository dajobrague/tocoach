import { NextRequest, NextResponse } from "next/server";

import { createSupabaseClient } from "@/lib/clients/supabase-api";
import {
  RecipeFolderConflictError,
  RecipeFolderService,
  RecipeFolderValidationError,
} from "@/lib/nutrition/recipes/recipe-folder-service";
import { guardRecipeRequest } from "@/lib/nutrition/recipes/recipe-request";

interface RouteContext {
  params: Promise<{ folderId: string }>;
}

// PATCH /api/recipe-folders/[folderId] — rename (bulk-retags recipes) and/or
// move (parent_id; null = root, cycles rejected).
export async function PATCH(request: NextRequest, context: RouteContext) {
  const guard = await guardRecipeRequest();

  if (guard.ok === false) {
    return guard.response;
  }

  try {
    const { folderId } = await context.params;
    const body = await request.json().catch(() => null);

    const patch: { name?: string; parentId?: string | null } = {};

    if (typeof body?.name === "string") patch.name = body.name;
    if (body?.parent_id === null || typeof body?.parent_id === "string") {
      patch.parentId = body.parent_id;
    }

    const service = new RecipeFolderService(createSupabaseClient());
    const folder = await service.update(
      guard.session.tenant_host,
      folderId,
      patch
    );

    if (folder === null) {
      return NextResponse.json(
        { success: false, error: "Carpeta no encontrada" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: folder });
  } catch (error) {
    if (error instanceof RecipeFolderValidationError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }
    if (error instanceof RecipeFolderConflictError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 409 }
      );
    }
    console.error("[RecipeFolders] update error:", error);

    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE — remove the folder only: children float to the root and recipes
// keep the tag (it shows again as a loose tag).
export async function DELETE(_request: NextRequest, context: RouteContext) {
  const guard = await guardRecipeRequest();

  if (guard.ok === false) {
    return guard.response;
  }

  try {
    const { folderId } = await context.params;
    const service = new RecipeFolderService(createSupabaseClient());
    const removed = await service.remove(guard.session.tenant_host, folderId);

    if (removed === false) {
      return NextResponse.json(
        { success: false, error: "Carpeta no encontrada" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[RecipeFolders] delete error:", error);

    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
