import { NextRequest, NextResponse } from "next/server";

import { createSupabaseClient } from "@/lib/clients/supabase-api";
import { parseUpdateOption } from "@/lib/nutrition/cycles/cycle-request";
import { MealSlotOptionService } from "@/lib/nutrition/cycles/meal-slot-option-service";
import {
  errorMessage,
  guardRecipeRequest,
  recipeNotFound,
} from "@/lib/nutrition/recipes/recipe-request";

const LOG_PREFIX = "[MealCycles API]";

interface RouteContext {
  params: Promise<{ id: string; slotId: string; optionId: string }>;
}

// PATCH /api/meal-cycles/[id]/slots/[slotId]/options/[optionId] — reorder, or
// re-portion (per-client quantities) when `quantities` is provided.
export async function PATCH(request: NextRequest, context: RouteContext) {
  const guard = await guardRecipeRequest();

  if (guard.ok === false) {
    return guard.response;
  }

  try {
    const { optionId } = await context.params;
    const body = await request.json().catch(() => null);
    const parsed = parseUpdateOption(body);

    if (parsed.ok === false) {
      return NextResponse.json(
        { success: false, error: parsed.error },
        { status: 400 }
      );
    }

    const service = new MealSlotOptionService(createSupabaseClient());
    const tenantHost = guard.session.tenant_host;
    const option =
      parsed.value.quantities !== undefined
        ? await service.updateOptionPortions(
            tenantHost,
            optionId,
            parsed.value.quantities,
            parsed.value.trainerComment
          )
        : await service.updateOption(
            tenantHost,
            optionId,
            parsed.value.position !== undefined
              ? { position: parsed.value.position }
              : {}
          );

    if (option === null) {
      return recipeNotFound();
    }

    return NextResponse.json({ success: true, data: option });
  } catch (error) {
    console.error(`${LOG_PREFIX} update option error:`, {
      correlationId: guard.correlationId,
      error: errorMessage(error),
    });

    return NextResponse.json(
      { success: false, error: "Error inesperado" },
      { status: 500 }
    );
  }
}

// DELETE /api/meal-cycles/[id]/slots/[slotId]/options/[optionId].
export async function DELETE(_request: NextRequest, context: RouteContext) {
  const guard = await guardRecipeRequest();

  if (guard.ok === false) {
    return guard.response;
  }

  try {
    const { optionId } = await context.params;
    const service = new MealSlotOptionService(createSupabaseClient());
    const option = await service.deleteOption(
      guard.session.tenant_host,
      optionId
    );

    if (option === null) {
      return recipeNotFound();
    }

    return NextResponse.json({ success: true, data: option });
  } catch (error) {
    console.error(`${LOG_PREFIX} delete option error:`, {
      correlationId: guard.correlationId,
      error: errorMessage(error),
    });

    return NextResponse.json(
      { success: false, error: "Error inesperado" },
      { status: 500 }
    );
  }
}
