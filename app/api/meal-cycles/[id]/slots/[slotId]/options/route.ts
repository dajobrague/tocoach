import { NextRequest, NextResponse } from "next/server";

import { createSupabaseClient } from "@/lib/clients/supabase-api";
import { parseAddOption } from "@/lib/nutrition/cycles/cycle-request";
import { MealSlotOptionService } from "@/lib/nutrition/cycles/meal-slot-option-service";
import {
  errorMessage,
  guardRecipeRequest,
  recipeNotFound,
} from "@/lib/nutrition/recipes/recipe-request";

const LOG_PREFIX = "[MealCycles API]";

interface RouteContext {
  params: Promise<{ id: string; slotId: string }>;
}

// POST /api/meal-cycles/[id]/slots/[slotId]/options — add a recipe/food option.
// Delegates to the snapshot service so the item is frozen at add-time (§4.1).
export async function POST(request: NextRequest, context: RouteContext) {
  const guard = await guardRecipeRequest();

  if (guard.ok === false) {
    return guard.response;
  }

  try {
    const { slotId } = await context.params;
    const body = await request.json().catch(() => null);
    const parsed = parseAddOption(body);

    if (parsed.ok === false) {
      return NextResponse.json(
        { success: false, error: parsed.error },
        { status: 400 }
      );
    }

    const service = new MealSlotOptionService(createSupabaseClient());
    const tenantHost = guard.session.tenant_host;
    const option =
      parsed.value.sourceType === "recipe"
        ? await service.addRecipeOption(
            tenantHost,
            slotId,
            parsed.value.recipeId,
            undefined,
            parsed.value.quantities,
            parsed.value.groupIndex,
            parsed.value.trainerComment
          )
        : await service.addFoodOption(
            tenantHost,
            slotId,
            parsed.value.ingredientId,
            parsed.value.quantity,
            undefined,
            parsed.value.groupIndex,
            parsed.value.trainerComment
          );

    if (option === null) {
      return recipeNotFound();
    }

    return NextResponse.json({ success: true, data: option }, { status: 201 });
  } catch (error) {
    console.error(`${LOG_PREFIX} add option error:`, {
      correlationId: guard.correlationId,
      error: errorMessage(error),
    });

    return NextResponse.json(
      { success: false, error: "Error inesperado" },
      { status: 500 }
    );
  }
}
