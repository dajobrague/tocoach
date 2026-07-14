import { NextRequest, NextResponse } from "next/server";

import { createSupabaseClient } from "@/lib/clients/supabase-api";
import { parseCreateCycle } from "@/lib/nutrition/cycles/cycle-request";
import { MealCycleService } from "@/lib/nutrition/cycles/meal-cycle-service";
import {
  errorMessage,
  guardRecipeRequest,
} from "@/lib/nutrition/recipes/recipe-request";

const LOG_PREFIX = "[MealCycles API]";

// GET /api/meal-cycles?clientId= — list the tenant's cycles.
export async function GET(request: NextRequest) {
  const guard = await guardRecipeRequest();

  if (guard.ok === false) {
    return guard.response;
  }

  try {
    const { searchParams } = new URL(request.url);
    const rawClientId = searchParams.get("clientId");
    const filter: { clientId?: number } = {};

    if (rawClientId !== null && rawClientId.trim().length > 0) {
      const clientId = Number(rawClientId);

      if (Number.isFinite(clientId)) filter.clientId = clientId;
    }

    const service = new MealCycleService(createSupabaseClient());
    const cycles = await service.list(guard.session.tenant_host, filter);

    return NextResponse.json({ success: true, data: cycles });
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

// POST /api/meal-cycles — create a draft cycle for the authed trainer.
export async function POST(request: NextRequest) {
  const guard = await guardRecipeRequest();

  if (guard.ok === false) {
    return guard.response;
  }

  try {
    const body = await request.json().catch(() => null);
    const parsed = parseCreateCycle(body);

    if (parsed.ok === false) {
      return NextResponse.json(
        { success: false, error: parsed.error },
        { status: 400 }
      );
    }

    const service = new MealCycleService(createSupabaseClient());
    const cycle = await service.create(guard.session.tenant_host, {
      trainerId: guard.session.trainer_id,
      clientId: parsed.value.clientId,
      name: parsed.value.name,
      durationDays: parsed.value.durationDays,
      status: "draft",
      ...(parsed.value.startDate !== undefined
        ? { startDate: parsed.value.startDate }
        : {}),
    });

    return NextResponse.json({ success: true, data: cycle }, { status: 201 });
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
