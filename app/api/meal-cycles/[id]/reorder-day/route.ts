import { NextRequest, NextResponse } from "next/server";

import { createSupabaseClient } from "@/lib/clients/supabase-api";
import { parseReorderDay } from "@/lib/nutrition/cycles/cycle-request";
import {
  MealCycleService,
  MealCycleValidationError,
} from "@/lib/nutrition/cycles/meal-cycle-service";
import {
  errorMessage,
  guardRecipeRequest,
  recipeNotFound,
} from "@/lib/nutrition/recipes/recipe-request";

const LOG_PREFIX = "[MealCycles API]";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// POST /api/meal-cycles/[id]/reorder-day — move a day to a new position; the
// days in between renumber. `duration_days` is unchanged.
export async function POST(request: NextRequest, context: RouteContext) {
  const guard = await guardRecipeRequest();

  if (guard.ok === false) {
    return guard.response;
  }

  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => null);
    const parsed = parseReorderDay(body);

    if (parsed.ok === false) {
      return NextResponse.json(
        { success: false, error: parsed.error },
        { status: 400 }
      );
    }

    const service = new MealCycleService(createSupabaseClient());
    const result = await service.reorderDay(
      guard.session.tenant_host,
      id,
      parsed.value.fromIndex,
      parsed.value.toIndex
    );

    if (result === null) {
      return recipeNotFound();
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    if (error instanceof MealCycleValidationError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }

    console.error(`${LOG_PREFIX} reorder day error:`, {
      correlationId: guard.correlationId,
      error: errorMessage(error),
    });

    return NextResponse.json(
      { success: false, error: "Error inesperado" },
      { status: 500 }
    );
  }
}
