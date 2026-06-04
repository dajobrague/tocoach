import { NextRequest, NextResponse } from "next/server";

import { createSupabaseClient } from "@/lib/clients/supabase-api";
import { resolveOwnedCycle } from "@/lib/nutrition/cycles/override-guard";
import { parseCreateOverride } from "@/lib/nutrition/cycles/override-request";
import { OverrideService } from "@/lib/nutrition/cycles/override-service";
import {
  errorMessage,
  guardRecipeRequest,
  recipeNotFound,
} from "@/lib/nutrition/recipes/recipe-request";

const LOG_PREFIX = "[MealCycle Overrides API]";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/meal-cycles/[id]/overrides — list the cycle's overrides.
export async function GET(_request: NextRequest, context: RouteContext) {
  const guard = await guardRecipeRequest();

  if (guard.ok === false) {
    return guard.response;
  }

  try {
    const { id } = await context.params;
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

    const overrides = await new OverrideService(supabase).listForCycle(
      guard.session.tenant_host,
      id
    );

    return NextResponse.json({ success: true, data: overrides });
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

// POST /api/meal-cycles/[id]/overrides — create a note or swap (with a scope).
export async function POST(request: NextRequest, context: RouteContext) {
  const guard = await guardRecipeRequest();

  if (guard.ok === false) {
    return guard.response;
  }

  try {
    const { id } = await context.params;
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
    const parsed = parseCreateOverride(body);

    if (parsed.ok === false) {
      return NextResponse.json(
        { success: false, error: parsed.error },
        { status: 400 }
      );
    }

    const override = await new OverrideService(supabase).create(
      guard.session.tenant_host,
      { ...parsed.value, cycleId: id }
    );

    // A null here means the slot/swap source wasn't found for the tenant.
    if (override === null) {
      return recipeNotFound();
    }

    return NextResponse.json(
      { success: true, data: override },
      { status: 201 }
    );
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
