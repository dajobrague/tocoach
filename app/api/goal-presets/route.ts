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
} from "@/lib/nutrition/recipes/recipe-request";

const LOG_PREFIX = "[GoalPresets API]";

// GET /api/goal-presets?clientId=123 — the client's named goal presets.
export async function GET(request: NextRequest) {
  const guard = await guardRecipeRequest();

  if (guard.ok === false) {
    return guard.response;
  }

  try {
    const clientId = Number(request.nextUrl.searchParams.get("clientId"));

    if (Number.isFinite(clientId) === false || clientId <= 0) {
      return NextResponse.json(
        { success: false, error: "clientId inválido" },
        { status: 400 }
      );
    }

    const service = new GoalPresetsService(createSupabaseClient());
    const presets = await service.list(guard.session.tenant_host, clientId);

    return NextResponse.json({ success: true, data: presets }, { status: 200 });
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

// POST /api/goal-presets — create a named preset for a client.
export async function POST(request: NextRequest) {
  const guard = await guardRecipeRequest();

  if (guard.ok === false) {
    return guard.response;
  }

  try {
    const body = await request.json().catch(() => null);
    const clientId = Number(
      (body as { client_id?: unknown } | null)?.client_id
    );

    if (Number.isFinite(clientId) === false || clientId <= 0) {
      return NextResponse.json(
        { success: false, error: "client_id inválido" },
        { status: 400 }
      );
    }

    const parsed = parseGoalPreset(body);

    if (parsed.ok === false) {
      return NextResponse.json(
        { success: false, error: parsed.error },
        { status: 400 }
      );
    }

    const service = new GoalPresetsService(createSupabaseClient());
    const created = await service.create(
      guard.session.tenant_host,
      clientId,
      parsed.value
    );

    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    if (error instanceof GoalPresetValidationError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }

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
