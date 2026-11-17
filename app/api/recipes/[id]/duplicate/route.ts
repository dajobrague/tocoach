import { NextRequest, NextResponse } from "next/server";

import { createSupabaseClient } from "@/lib/clients/supabase-api";
import { duplicateRecipe } from "@/lib/nutrition/recipes/recipe-duplicate";
import {
  errorMessage,
  guardRecipeRequest,
  recipeNotFound,
} from "@/lib/nutrition/recipes/recipe-request";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// POST /api/recipes/[id]/duplicate — copy a recipe of this tenant.
export async function POST(_request: NextRequest, context: RouteContext) {
  const guard = await guardRecipeRequest();

  if (guard.ok === false) {
    return guard.response;
  }

  try {
    const { id } = await context.params;
    const copy = await duplicateRecipe(
      createSupabaseClient(),
      guard.session.tenant_host,
      guard.session.trainer_id,
      id
    );

    if (copy === null) {
      return recipeNotFound();
    }

    return NextResponse.json({ success: true, data: copy }, { status: 201 });
  } catch (error) {
    console.error("[Recipes API] duplicate error:", {
      correlationId: guard.correlationId,
      error: errorMessage(error),
    });

    return NextResponse.json(
      { success: false, error: "Error inesperado" },
      { status: 500 }
    );
  }
}
