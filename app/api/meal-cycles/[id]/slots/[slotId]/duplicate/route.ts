import { NextRequest, NextResponse } from "next/server";

import { createSupabaseClient } from "@/lib/clients/supabase-api";
import { MealCycleService } from "@/lib/nutrition/cycles/meal-cycle-service";
import {
  errorMessage,
  guardRecipeRequest,
  recipeNotFound,
} from "@/lib/nutrition/recipes/recipe-request";

const LOG_PREFIX = "[MealCycles API]";

interface RouteContext {
  params: Promise<{ id: string; slotId: string }>;
}

// POST /api/meal-cycles/[id]/slots/[slotId]/duplicate — "Duplicar comida":
// a copy of the meal right below it, same day, options verbatim.
export async function POST(_request: NextRequest, context: RouteContext) {
  const guard = await guardRecipeRequest();

  if (guard.ok === false) {
    return guard.response;
  }

  try {
    const { slotId } = await context.params;
    const service = new MealCycleService(createSupabaseClient());
    const slot = await service.duplicateSlot(guard.session.tenant_host, slotId);

    if (slot === null) {
      return recipeNotFound();
    }

    return NextResponse.json({ success: true, data: slot }, { status: 201 });
  } catch (error) {
    console.error(`${LOG_PREFIX} duplicate slot error:`, {
      correlationId: guard.correlationId,
      error: errorMessage(error),
    });

    return NextResponse.json(
      { success: false, error: "Error inesperado" },
      { status: 500 }
    );
  }
}
