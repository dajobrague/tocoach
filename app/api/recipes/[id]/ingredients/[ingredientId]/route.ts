import { NextRequest, NextResponse } from "next/server";

import { createSupabaseClient } from "@/lib/clients/supabase-api";
import {
  errorMessage,
  guardRecipeRequest,
  parseUpdateIngredientInput,
  recipeNotFound,
} from "@/lib/nutrition/recipes/recipe-request";
import { RecipeIngredientService } from "@/lib/nutrition/recipes/recipe-ingredient-service";

const LOG_PREFIX = "[Recipe Ingredients API]";

type RouteContext = { params: Promise<{ id: string; ingredientId: string }> };

// PATCH /api/recipes/[id]/ingredients/[ingredientId] — update a line (recomputes).
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const guard = await guardRecipeRequest();

  if (guard.ok === false) {
    return guard.response;
  }

  try {
    const { id, ingredientId } = await params;
    const body = await request.json().catch(() => null);
    const parsed = parseUpdateIngredientInput(body);

    if (parsed.ok === false) {
      return NextResponse.json(
        { success: false, error: parsed.error },
        { status: 400 }
      );
    }

    const service = new RecipeIngredientService(createSupabaseClient());
    const row = await service.update(
      guard.session.tenant_host,
      id,
      ingredientId,
      parsed.value
    );

    if (row === null) {
      return recipeNotFound();
    }

    return NextResponse.json({ success: true, data: row });
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

// DELETE /api/recipes/[id]/ingredients/[ingredientId] — remove a line (recomputes).
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const guard = await guardRecipeRequest();

  if (guard.ok === false) {
    return guard.response;
  }

  try {
    const { id, ingredientId } = await params;
    const service = new RecipeIngredientService(createSupabaseClient());
    const row = await service.remove(
      guard.session.tenant_host,
      id,
      ingredientId
    );

    if (row === null) {
      return recipeNotFound();
    }

    return NextResponse.json({ success: true, data: row });
  } catch (error) {
    console.error(`${LOG_PREFIX} remove error:`, {
      correlationId: guard.correlationId,
      error: errorMessage(error),
    });

    return NextResponse.json(
      { success: false, error: "Error inesperado" },
      { status: 500 }
    );
  }
}
