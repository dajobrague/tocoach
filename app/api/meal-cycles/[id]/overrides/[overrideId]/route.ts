import { NextRequest, NextResponse } from "next/server";

import { createSupabaseClient } from "@/lib/clients/supabase-api";
import { resolveOwnedCycle } from "@/lib/nutrition/cycles/override-guard";
import { parseUpdateOverride } from "@/lib/nutrition/cycles/override-request";
import { OverrideService } from "@/lib/nutrition/cycles/override-service";
import {
  errorMessage,
  guardRecipeRequest,
  recipeNotFound,
} from "@/lib/nutrition/recipes/recipe-request";

const LOG_PREFIX = "[MealCycle Overrides API]";

interface RouteContext {
  params: Promise<{ id: string; overrideId: string }>;
}

// PATCH /api/meal-cycles/[id]/overrides/[overrideId] — update a note/swap.
export async function PATCH(request: NextRequest, context: RouteContext) {
  const guard = await guardRecipeRequest();

  if (guard.ok === false) {
    return guard.response;
  }

  try {
    const { id, overrideId } = await context.params;
    const supabase = createSupabaseClient();
    const cycle = await resolveOwnedCycle(
      supabase,
      guard.session.tenant_host,
      guard.session.trainer_id,
      id
    );

    if (cycle === null) {
      return recipeNotFound();
    }

    const body = await request.json().catch(() => null);
    const parsed = parseUpdateOverride(body);

    if (parsed.ok === false) {
      return NextResponse.json(
        { success: false, error: parsed.error },
        { status: 400 }
      );
    }

    const updated = await new OverrideService(supabase).update(
      guard.session.tenant_host,
      overrideId,
      parsed.value
    );

    if (updated === null) {
      return recipeNotFound();
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
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

// DELETE /api/meal-cycles/[id]/overrides/[overrideId] — remove an override.
export async function DELETE(_request: NextRequest, context: RouteContext) {
  const guard = await guardRecipeRequest();

  if (guard.ok === false) {
    return guard.response;
  }

  try {
    const { id, overrideId } = await context.params;
    const supabase = createSupabaseClient();
    const cycle = await resolveOwnedCycle(
      supabase,
      guard.session.tenant_host,
      guard.session.trainer_id,
      id
    );

    if (cycle === null) {
      return recipeNotFound();
    }

    const removed = await new OverrideService(supabase).delete(
      guard.session.tenant_host,
      overrideId
    );

    if (removed === null) {
      return recipeNotFound();
    }

    return NextResponse.json({ success: true, data: removed });
  } catch (error) {
    console.error(`${LOG_PREFIX} delete error:`, {
      correlationId: guard.correlationId,
      error: errorMessage(error),
    });

    return NextResponse.json(
      { success: false, error: "Error inesperado" },
      { status: 500 }
    );
  }
}
