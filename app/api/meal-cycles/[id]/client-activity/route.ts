import { NextRequest, NextResponse } from "next/server";

import { createSupabaseClient } from "@/lib/clients/supabase-api";
import { MealCycleService } from "@/lib/nutrition/cycles/meal-cycle-service";
import { getMenuChoices } from "@/lib/nutrition/cycles/menu-choice-service";
import { getClientSelections } from "@/lib/nutrition/cycles/option-selection";
import {
  errorMessage,
  guardRecipeRequest,
  recipeNotFound,
} from "@/lib/nutrition/recipes/recipe-request";

const LOG_PREFIX = "[MealCycles API]";
const YMD = /^\d{4}-\d{2}-\d{2}$/;

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/meal-cycles/[id]/client-activity?from&to — what the client actually
 * did, for the trainer's retrospective calendar: their menu choice per date in
 * [from, to] (only choices made against THIS cycle) and their current standing
 * alternative selections (slotId → optionId). Tenant-scoped via the cycle.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const guard = await guardRecipeRequest();

  if (guard.ok === false) {
    return guard.response;
  }

  try {
    const { id } = await context.params;
    const from = request.nextUrl.searchParams.get("from") ?? "";
    const to = request.nextUrl.searchParams.get("to") ?? "";

    if (YMD.test(from) === false || YMD.test(to) === false || from > to) {
      return NextResponse.json(
        { success: false, error: "from/to inválidos (YYYY-MM-DD)" },
        { status: 400 }
      );
    }

    const supabase = createSupabaseClient();
    const cycle = await new MealCycleService(supabase).getById(
      guard.session.tenant_host,
      id
    );

    if (cycle === null) {
      return recipeNotFound();
    }

    const [choices, selections] = await Promise.all([
      getMenuChoices(supabase, cycle.client_id, from, to),
      getClientSelections(supabase, cycle.client_id),
    ]);

    const choiceByDate: Record<string, number> = {};

    for (const choice of choices) {
      if (choice.cycle_id === cycle.id) {
        choiceByDate[choice.date] = choice.day_index;
      }
    }

    const selectionBySlot: Record<string, string> = {};

    for (const selection of selections) {
      selectionBySlot[selection.slot_id] = selection.option_id;
    }

    return NextResponse.json(
      {
        success: true,
        data: { choices: choiceByDate, selections: selectionBySlot },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(`${LOG_PREFIX} client activity error:`, {
      correlationId: guard.correlationId,
      error: errorMessage(error),
    });

    return NextResponse.json(
      { success: false, error: "Error inesperado" },
      { status: 500 }
    );
  }
}
