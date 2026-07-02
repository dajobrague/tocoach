import { NextRequest, NextResponse } from "next/server";

import { createSupabaseClient } from "@/lib/clients/supabase-api";
import {
  errorMessage,
  guardRecipeRequest,
  parseAddIngredientInput,
  parseReplaceIngredientsInput,
  recipeNotFound,
} from "@/lib/nutrition/recipes/recipe-request";
import {
  RecipeIngredientService,
  RecipeIngredientValidationError,
} from "@/lib/nutrition/recipes/recipe-ingredient-service";

const LOG_PREFIX = "[Recipe Ingredients API]";

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/recipes/[id]/ingredients — list a recipe's ingredient lines.
export async function GET(request: NextRequest, { params }: RouteContext) {
  const guard = await guardRecipeRequest();

  if (guard.ok === false) {
    return guard.response;
  }

  try {
    const { id } = await params;
    const service = new RecipeIngredientService(createSupabaseClient());
    const rows = await service.list(guard.session.tenant_host, id);

    if (rows === null) {
      return recipeNotFound();
    }

    return NextResponse.json({ success: true, data: rows });
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

// PUT /api/recipes/[id]/ingredients — replace the whole ingredient list (the
// editor's explicit save; recomputes totals once).
export async function PUT(request: NextRequest, { params }: RouteContext) {
  const guard = await guardRecipeRequest();

  if (guard.ok === false) {
    return guard.response;
  }

  try {
    const { id } = await params;
    const body = await request.json().catch(() => null);
    const parsed = parseReplaceIngredientsInput(body);

    if (parsed.ok === false) {
      return NextResponse.json(
        { success: false, error: parsed.error },
        { status: 400 }
      );
    }

    const service = new RecipeIngredientService(createSupabaseClient());
    const rows = await service.replaceAll(
      guard.session.tenant_host,
      id,
      parsed.value
    );

    if (rows === null) {
      return recipeNotFound();
    }

    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    if (error instanceof RecipeIngredientValidationError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }

    console.error(`${LOG_PREFIX} replace error:`, {
      correlationId: guard.correlationId,
      error: errorMessage(error),
    });

    return NextResponse.json(
      { success: false, error: "Error inesperado" },
      { status: 500 }
    );
  }
}

// POST /api/recipes/[id]/ingredients — add an ingredient line (recomputes totals).
export async function POST(request: NextRequest, { params }: RouteContext) {
  const guard = await guardRecipeRequest();

  if (guard.ok === false) {
    return guard.response;
  }

  try {
    const { id } = await params;
    const body = await request.json().catch(() => null);
    const parsed = parseAddIngredientInput(body);

    if (parsed.ok === false) {
      return NextResponse.json(
        { success: false, error: parsed.error },
        { status: 400 }
      );
    }

    const service = new RecipeIngredientService(createSupabaseClient());
    const row = await service.add(guard.session.tenant_host, id, parsed.value);

    if (row === null) {
      return recipeNotFound();
    }

    return NextResponse.json({ success: true, data: row }, { status: 201 });
  } catch (error) {
    if (error instanceof RecipeIngredientValidationError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }

    console.error(`${LOG_PREFIX} add error:`, {
      correlationId: guard.correlationId,
      error: errorMessage(error),
    });

    return NextResponse.json(
      { success: false, error: "Error inesperado" },
      { status: 500 }
    );
  }
}
