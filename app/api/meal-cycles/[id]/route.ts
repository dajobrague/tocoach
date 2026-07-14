import { NextRequest, NextResponse } from "next/server";

import { createSupabaseClient } from "@/lib/clients/supabase-api";
import { parseUpdateCycle } from "@/lib/nutrition/cycles/cycle-request";
import {
  ActiveCycleConflictError,
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

// GET /api/meal-cycles/[id] — single cycle with its slots + options tree.
export async function GET(_request: NextRequest, context: RouteContext) {
  const guard = await guardRecipeRequest();

  if (guard.ok === false) {
    return guard.response;
  }

  try {
    const { id } = await context.params;
    const service = new MealCycleService(createSupabaseClient());
    const tree = await service.getByIdWithTree(guard.session.tenant_host, id);

    if (tree === null) {
      return recipeNotFound();
    }

    return NextResponse.json({ success: true, data: tree });
  } catch (error) {
    console.error(`${LOG_PREFIX} get error:`, {
      correlationId: guard.correlationId,
      error: errorMessage(error),
    });

    return NextResponse.json(
      { success: false, error: "Error inesperado" },
      { status: 500 }
    );
  }
}

// PATCH /api/meal-cycles/[id] — update duration/start_date/status (incl. archive).
export async function PATCH(request: NextRequest, context: RouteContext) {
  const guard = await guardRecipeRequest();

  if (guard.ok === false) {
    return guard.response;
  }

  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => null);
    const parsed = parseUpdateCycle(body);

    if (parsed.ok === false) {
      return NextResponse.json(
        { success: false, error: parsed.error },
        { status: 400 }
      );
    }

    const service = new MealCycleService(createSupabaseClient());
    const updated = await service.update(
      guard.session.tenant_host,
      id,
      parsed.value
    );

    if (updated === null) {
      return recipeNotFound();
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    if (error instanceof ActiveCycleConflictError) {
      return NextResponse.json(
        { success: false, error: "El cliente ya tiene un ciclo activo" },
        { status: 409 }
      );
    }

    if (error instanceof MealCycleValidationError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }

    console.error(`${LOG_PREFIX} update error:`, {
      correlationId: guard.correlationId,
      error: errorMessage(error),
    });

    return NextResponse.json(
      { success: false, error: "Error inesperado" },
      { status: 500 }
    );
  }
}
