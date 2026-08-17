import { NextRequest, NextResponse } from "next/server";

import { createSupabaseClient } from "@/lib/clients/supabase-api";
import { guardRecipeRequest } from "@/lib/nutrition/recipes/recipe-request";
import { MealCycleTemplateService } from "@/lib/nutrition/templates/meal-cycle-template-service";

interface RouteContext {
  params: Promise<{ templateId: string }>;
}

const YMD = /^\d{4}-\d{2}-\d{2}$/;

// POST /api/meal-cycle-templates/[templateId]/instantiate — create a DRAFT
// cycle for a client from this template (frozen snapshots copied verbatim).
// Body: { clientId: number; name?: string; startDate?: "YYYY-MM-DD" }.
export async function POST(request: NextRequest, context: RouteContext) {
  const guard = await guardRecipeRequest();

  if (guard.ok === false) {
    return guard.response;
  }

  try {
    const { templateId } = await context.params;
    const body = await request.json().catch(() => null);
    const clientId = Number(body?.clientId);

    if (Number.isInteger(clientId) === false || clientId <= 0) {
      return NextResponse.json(
        { success: false, error: "clientId inválido" },
        { status: 400 }
      );
    }

    const name = typeof body?.name === "string" ? body.name : undefined;
    const startDate =
      typeof body?.startDate === "string" && YMD.test(body.startDate)
        ? body.startDate
        : undefined;

    const service = new MealCycleTemplateService(createSupabaseClient());
    const cycle = await service.instantiate(
      guard.session.tenant_host,
      templateId,
      {
        trainerId: guard.session.trainer_id,
        clientId,
        ...(name !== undefined ? { name } : {}),
        ...(startDate !== undefined ? { startDate } : {}),
      }
    );

    if (cycle === null) {
      return NextResponse.json(
        { success: false, error: "Plantilla no encontrada" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: cycle }, { status: 201 });
  } catch (error) {
    console.error("[MealCycleTemplates] instantiate error:", error);

    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
