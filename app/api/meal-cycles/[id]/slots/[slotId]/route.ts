import { NextRequest, NextResponse } from "next/server";

import { createSupabaseClient } from "@/lib/clients/supabase-api";
import { parseUpdateSlot } from "@/lib/nutrition/cycles/cycle-request";
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
  params: Promise<{ id: string; slotId: string }>;
}

// PATCH /api/meal-cycles/[id]/slots/[slotId] — reorder / relabel / move a slot.
export async function PATCH(request: NextRequest, context: RouteContext) {
  const guard = await guardRecipeRequest();

  if (guard.ok === false) {
    return guard.response;
  }

  try {
    const { slotId } = await context.params;
    const body = await request.json().catch(() => null);
    const parsed = parseUpdateSlot(body);

    if (parsed.ok === false) {
      return NextResponse.json(
        { success: false, error: parsed.error },
        { status: 400 }
      );
    }

    const service = new MealCycleService(createSupabaseClient());
    const slot = await service.updateSlot(
      guard.session.tenant_host,
      slotId,
      parsed.value
    );

    if (slot === null) {
      return recipeNotFound();
    }

    return NextResponse.json({ success: true, data: slot });
  } catch (error) {
    if (error instanceof MealCycleValidationError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }

    console.error(`${LOG_PREFIX} update slot error:`, {
      correlationId: guard.correlationId,
      error: errorMessage(error),
    });

    return NextResponse.json(
      { success: false, error: "Error inesperado" },
      { status: 500 }
    );
  }
}

// DELETE /api/meal-cycles/[id]/slots/[slotId] — delete a slot (options cascade).
export async function DELETE(_request: NextRequest, context: RouteContext) {
  const guard = await guardRecipeRequest();

  if (guard.ok === false) {
    return guard.response;
  }

  try {
    const { slotId } = await context.params;
    const service = new MealCycleService(createSupabaseClient());
    const slot = await service.deleteSlot(guard.session.tenant_host, slotId);

    if (slot === null) {
      return recipeNotFound();
    }

    return NextResponse.json({ success: true, data: slot });
  } catch (error) {
    console.error(`${LOG_PREFIX} delete slot error:`, {
      correlationId: guard.correlationId,
      error: errorMessage(error),
    });

    return NextResponse.json(
      { success: false, error: "Error inesperado" },
      { status: 500 }
    );
  }
}
