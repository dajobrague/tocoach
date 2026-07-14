import { NextRequest, NextResponse } from "next/server";

import { createSupabaseClient } from "@/lib/clients/supabase-api";
import { parseAddSlot } from "@/lib/nutrition/cycles/cycle-request";
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

// POST /api/meal-cycles/[id]/slots — add a slot (day_index range-checked).
export async function POST(request: NextRequest, context: RouteContext) {
  const guard = await guardRecipeRequest();

  if (guard.ok === false) {
    return guard.response;
  }

  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => null);
    const parsed = parseAddSlot(body);

    if (parsed.ok === false) {
      return NextResponse.json(
        { success: false, error: parsed.error },
        { status: 400 }
      );
    }

    const service = new MealCycleService(createSupabaseClient());
    const slot = await service.addSlot(guard.session.tenant_host, id, {
      dayIndex: parsed.value.dayIndex,
      ...(parsed.value.label !== undefined
        ? { label: parsed.value.label }
        : {}),
      ...(parsed.value.position !== undefined
        ? { position: parsed.value.position }
        : {}),
    });

    if (slot === null) {
      return recipeNotFound();
    }

    return NextResponse.json({ success: true, data: slot }, { status: 201 });
  } catch (error) {
    if (error instanceof MealCycleValidationError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }

    console.error(`${LOG_PREFIX} add slot error:`, {
      correlationId: guard.correlationId,
      error: errorMessage(error),
    });

    return NextResponse.json(
      { success: false, error: "Error inesperado" },
      { status: 500 }
    );
  }
}
