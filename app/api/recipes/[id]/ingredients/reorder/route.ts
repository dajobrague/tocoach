import { NextRequest, NextResponse } from "next/server";

import { createSupabaseClient } from "@/lib/clients/supabase-api";
import { RecipeIngredientService } from "@/lib/nutrition/recipes/recipe-ingredient-service";
import {
  errorMessage,
  guardRecipeRequest,
  parseReorderInput,
  recipeNotFound,
} from "@/lib/nutrition/recipes/recipe-request";

const LOG_PREFIX = "[Recipe Ingredients API]";

type RouteContext = { params: Promise<{ id: string }> };

// PATCH /api/recipes/[id]/ingredients/reorder — persist a new ingredient order.
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const guard = await guardRecipeRequest();

  if (guard.ok === false) {
    return guard.response;
  }

  try {
    const { id } = await params;
    const body = await request.json().catch(() => null);
    const parsed = parseReorderInput(body);

    if (parsed.ok === false) {
      return NextResponse.json(
        { success: false, error: parsed.error },
        { status: 400 }
      );
    }

    const service = new RecipeIngredientService(createSupabaseClient());
    const rows = await service.reorder(
      guard.session.tenant_host,
      id,
      parsed.value
    );

    if (rows === null) {
      return recipeNotFound();
    }

    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    console.error(`${LOG_PREFIX} reorder error:`, {
      correlationId: guard.correlationId,
      error: errorMessage(error),
    });

    return NextResponse.json(
      { success: false, error: "Error inesperado" },
      { status: 500 }
    );
  }
}
