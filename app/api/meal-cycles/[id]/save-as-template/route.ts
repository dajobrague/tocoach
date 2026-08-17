import { NextRequest, NextResponse } from "next/server";

import { createSupabaseClient } from "@/lib/clients/supabase-api";
import { MealCycleValidationError } from "@/lib/nutrition/cycles/meal-cycle-service";
import { guardRecipeRequest } from "@/lib/nutrition/recipes/recipe-request";
import { MealCycleTemplateService } from "@/lib/nutrition/templates/meal-cycle-template-service";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// POST /api/meal-cycles/[id]/save-as-template — freeze this cycle's full
// days → meals → options tree into a reusable tenant-wide template.
// Body: { name?: string } (defaults to the cycle's name server-side is NOT
// done here — the UI always sends a name).
export async function POST(request: NextRequest, context: RouteContext) {
  const guard = await guardRecipeRequest();

  if (guard.ok === false) {
    return guard.response;
  }

  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => null);
    const name = typeof body?.name === "string" ? body.name : "";

    const service = new MealCycleTemplateService(createSupabaseClient());
    const summary = await service.saveFromCycle(
      guard.session.tenant_host,
      guard.session.trainer_id,
      id,
      name
    );

    if (summary === null) {
      return NextResponse.json(
        { success: false, error: "Plan no encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: summary });
  } catch (error) {
    if (error instanceof MealCycleValidationError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }
    console.error("[MealCycleTemplates] save-as-template error:", error);

    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
