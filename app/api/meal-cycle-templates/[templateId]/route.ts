import { NextRequest, NextResponse } from "next/server";

import { createSupabaseClient } from "@/lib/clients/supabase-api";
import { guardRecipeRequest } from "@/lib/nutrition/recipes/recipe-request";
import { MealCycleTemplateService } from "@/lib/nutrition/templates/meal-cycle-template-service";

interface RouteContext {
  params: Promise<{ templateId: string }>;
}

// DELETE /api/meal-cycle-templates/[templateId] — remove a template.
// Cycles created from it are standalone copies and are not affected.
export async function DELETE(_request: NextRequest, context: RouteContext) {
  const guard = await guardRecipeRequest();

  if (guard.ok === false) {
    return guard.response;
  }

  try {
    const { templateId } = await context.params;
    const service = new MealCycleTemplateService(createSupabaseClient());
    const removed = await service.remove(guard.session.tenant_host, templateId);

    if (removed === false) {
      return NextResponse.json(
        { success: false, error: "Plantilla no encontrada" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[MealCycleTemplates] delete error:", error);

    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
