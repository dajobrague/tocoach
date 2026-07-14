import { NextRequest, NextResponse } from "next/server";

import { createSupabaseClient } from "@/lib/clients/supabase-api";
import {
  ClientGoalsService,
  ClientGoalsValidationError,
} from "@/lib/nutrition/goals/client-goals-service";
import { parseNutritionGoals } from "@/lib/nutrition/goals/goals-request";
import {
  errorMessage,
  guardRecipeRequest,
} from "@/lib/nutrition/recipes/recipe-request";

const LOG_PREFIX = "[NutritionGoals API]";

// GET /api/nutrition-goals?clientId=123 — the client's saved daily goals, or
// null when they have none yet (the app falls back to its defaults).
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

    const service = new ClientGoalsService(createSupabaseClient());
    const goals = await service.get(guard.session.tenant_host, clientId);

    return NextResponse.json({ success: true, data: goals }, { status: 200 });
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

// PUT /api/nutrition-goals — create or replace the client's daily goals.
export async function PUT(request: NextRequest) {
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

    const parsed = parseNutritionGoals(body);

    if (parsed.ok === false) {
      return NextResponse.json(
        { success: false, error: parsed.error },
        { status: 400 }
      );
    }

    const service = new ClientGoalsService(createSupabaseClient());
    const saved = await service.upsert(
      guard.session.tenant_host,
      clientId,
      parsed.value
    );

    return NextResponse.json({ success: true, data: saved }, { status: 200 });
  } catch (error) {
    if (error instanceof ClientGoalsValidationError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }

    console.error(`${LOG_PREFIX} put error:`, {
      correlationId: guard.correlationId,
      error: errorMessage(error),
    });

    return NextResponse.json(
      { success: false, error: "Error inesperado" },
      { status: 500 }
    );
  }
}
