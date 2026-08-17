import { NextRequest, NextResponse } from "next/server";

import { createSupabaseClient } from "@/lib/clients/supabase-api";
import {
  RecipeFolderConflictError,
  RecipeFolderService,
  RecipeFolderValidationError,
} from "@/lib/nutrition/recipes/recipe-folder-service";
import { guardRecipeRequest } from "@/lib/nutrition/recipes/recipe-request";

// GET /api/recipe-folders — the tenant's folder hierarchy (flat rows; the
// client builds the tree). POST creates a folder, optionally nested.
export async function GET() {
  const guard = await guardRecipeRequest();

  if (guard.ok === false) {
    return guard.response;
  }

  try {
    const service = new RecipeFolderService(createSupabaseClient());
    const folders = await service.list(guard.session.tenant_host);

    return NextResponse.json({ success: true, data: folders });
  } catch (error) {
    console.error("[RecipeFolders] list error:", error);

    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const guard = await guardRecipeRequest();

  if (guard.ok === false) {
    return guard.response;
  }

  try {
    const body = await request.json().catch(() => null);
    const name = typeof body?.name === "string" ? body.name : "";
    const parentId =
      typeof body?.parent_id === "string" ? body.parent_id : null;

    const service = new RecipeFolderService(createSupabaseClient());
    const folder = await service.create(guard.session.tenant_host, {
      name,
      parentId,
    });

    return NextResponse.json({ success: true, data: folder }, { status: 201 });
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
    console.error("[RecipeFolders] create error:", error);

    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
