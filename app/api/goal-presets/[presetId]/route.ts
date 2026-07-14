import { NextRequest, NextResponse } from "next/server";

import { createSupabaseClient } from "@/lib/clients/supabase-api";
import {
  GoalPresetsService,
  GoalPresetValidationError,
} from "@/lib/nutrition/goals/goal-presets-service";
import { parseGoalPreset } from "@/lib/nutrition/goals/goals-request";
import {
  errorMessage,
  guardRecipeRequest,
  recipeNotFound,
} from "@/lib/nutrition/recipes/recipe-request";

const LOG_PREFIX = "[GoalPresets API]";

interface RouteContext {
  params: Promise<{ presetId: string }>;
}

// PATCH /api/goal-presets/[presetId] — replace a preset's name and targets.
export async function PATCH(request: NextRequest, context: RouteContext) {
  const guard = await guardRecipeRequest();

  if (guard.ok === false) {
    return guard.response;
  }

  try {
    const { presetId } = await context.params;
    const body = await request.json().catch(() => null);
    const parsed = parseGoalPreset(body);

    if (parsed.ok === false) {
      return NextResponse.json(
        { success: false, error: parsed.error },
        { status: 400 }
      );
    }

    const service = new GoalPresetsService(createSupabaseClient());
    const updated = await service.update(
      guard.session.tenant_host,
      presetId,
      parsed.value
    );

    if (updated === null) {
      return recipeNotFound();
    }

    return NextResponse.json({ success: true, data: updated }, { status: 200 });
  } catch (error) {
    if (error instanceof GoalPresetValidationError) {
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

// DELETE /api/goal-presets/[presetId] — days using it fall back to defaults.
export async function DELETE(_request: NextRequest, context: RouteContext) {
  const guard = await guardRecipeRequest();

  if (guard.ok === false) {
    return guard.response;
  }

  try {
    const { presetId } = await context.params;
    const service = new GoalPresetsService(createSupabaseClient());
    const deleted = await service.delete(guard.session.tenant_host, presetId);

    if (deleted === false) {
      return recipeNotFound();
    }

    return NextResponse.json({ success: true }, { status: 200 });
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
