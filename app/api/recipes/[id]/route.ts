import { NextRequest, NextResponse } from "next/server";

import { createSupabaseClient } from "@/lib/clients/supabase-api";
import {
  errorMessage,
  guardRecipeRequest,
  parseUpdateInput,
  recipeNotFound,
} from "@/lib/nutrition/recipes/recipe-request";
import { RecipeService } from "@/lib/nutrition/recipes/recipe-service";

const LOG_PREFIX = "[Recipes API]";

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/recipes/[id] — one recipe (404 if not found or another tenant's).
export async function GET(request: NextRequest, { params }: RouteContext) {
  const guard = await guardRecipeRequest();

  if (guard.ok === false) {
    return guard.response;
  }

  try {
    const { id } = await params;
    const service = new RecipeService(createSupabaseClient());
    const recipe = await service.getById(guard.session.tenant_host, id);

    if (recipe === null) {
      return recipeNotFound();
    }

    return NextResponse.json({ success: true, data: recipe });
  } catch (error) {
    console.error(`${LOG_PREFIX} get error:`, {
      correlationId: guard.correlationId,
      error: errorMessage(error),
    });

    return NextResponse.json(
      { success: false, error: "Error inesperado" },
      { status: 500 }
    );
  }
}

// PATCH /api/recipes/[id] — update shell fields.
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const guard = await guardRecipeRequest();

  if (guard.ok === false) {
    return guard.response;
  }

  try {
    const { id } = await params;
    const body = await request.json().catch(() => null);
    const parsed = parseUpdateInput(body);

    if (parsed.ok === false) {
      return NextResponse.json(
        { success: false, error: parsed.error },
        { status: 400 }
      );
    }

    const service = new RecipeService(createSupabaseClient());
    const updated = await service.update(
      guard.session.tenant_host,
      id,
      parsed.value
    );

    if (updated === null) {
      return recipeNotFound();
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error(`${LOG_PREFIX} update error:`, {
      correlationId: guard.correlationId,
      error: errorMessage(error),
    });

    return NextResponse.json(
      { success: false, error: "Error inesperado" },
      { status: 500 }
    );
  }
}

// DELETE /api/recipes/[id] — soft delete (archive); never hard deletes.
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const guard = await guardRecipeRequest();

  if (guard.ok === false) {
    return guard.response;
  }

  try {
    const { id } = await params;
    const service = new RecipeService(createSupabaseClient());
    const archived = await service.archive(guard.session.tenant_host, id);

    if (archived === null) {
      return recipeNotFound();
    }

    return NextResponse.json({ success: true, data: archived });
  } catch (error) {
    console.error(`${LOG_PREFIX} archive error:`, {
      correlationId: guard.correlationId,
      error: errorMessage(error),
    });

    return NextResponse.json(
      { success: false, error: "Error inesperado" },
      { status: 500 }
    );
  }
}
