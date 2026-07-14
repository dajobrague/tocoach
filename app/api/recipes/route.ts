import { NextRequest, NextResponse } from "next/server";

import { createSupabaseClient } from "@/lib/clients/supabase-api";
import {
  errorMessage,
  guardRecipeRequest,
  parseCreateInput,
  parseListFilter,
} from "@/lib/nutrition/recipes/recipe-request";
import { RecipeService } from "@/lib/nutrition/recipes/recipe-service";

const LOG_PREFIX = "[Recipes API]";

// GET /api/recipes?status=&tag=&q= — list the tenant's recipes.
export async function GET(request: NextRequest) {
  const guard = await guardRecipeRequest();

  if (guard.ok === false) {
    return guard.response;
  }

  try {
    const { searchParams } = new URL(request.url);
    const service = new RecipeService(createSupabaseClient());
    const recipes = await service.list(
      guard.session.tenant_host,
      parseListFilter(searchParams)
    );

    return NextResponse.json({ success: true, data: recipes });
  } catch (error) {
    console.error(`${LOG_PREFIX} list error:`, {
      correlationId: guard.correlationId,
      error: errorMessage(error),
    });

    return NextResponse.json(
      { success: false, error: "Error inesperado" },
      { status: 500 }
    );
  }
}

// POST /api/recipes — create a recipe shell.
export async function POST(request: NextRequest) {
  const guard = await guardRecipeRequest();

  if (guard.ok === false) {
    return guard.response;
  }

  try {
    const body = await request.json().catch(() => null);
    const parsed = parseCreateInput(body);

    if (parsed.ok === false) {
      return NextResponse.json(
        { success: false, error: parsed.error },
        { status: 400 }
      );
    }

    const service = new RecipeService(createSupabaseClient());
    const recipe = await service.create(
      guard.session.tenant_host,
      guard.session.trainer_id,
      parsed.value
    );

    return NextResponse.json({ success: true, data: recipe }, { status: 201 });
  } catch (error) {
    console.error(`${LOG_PREFIX} create error:`, {
      correlationId: guard.correlationId,
      error: errorMessage(error),
    });

    return NextResponse.json(
      { success: false, error: "Error inesperado" },
      { status: 500 }
    );
  }
}
