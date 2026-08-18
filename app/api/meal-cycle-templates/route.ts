import { NextResponse } from "next/server";

import { createSupabaseClient } from "@/lib/clients/supabase-api";
import { guardRecipeRequest } from "@/lib/nutrition/recipes/recipe-request";
import { MealCycleTemplateService } from "@/lib/nutrition/templates/meal-cycle-template-service";

// GET /api/meal-cycle-templates — the tenant's meal-plan templates, newest
// first (summaries only, no document payload).
export async function GET() {
  const guard = await guardRecipeRequest();

  if (guard.ok === false) {
    return guard.response;
  }

  try {
    const service = new MealCycleTemplateService(createSupabaseClient());
    const templates = await service.list(guard.session.tenant_host);

    return NextResponse.json({ success: true, data: templates });
  } catch (error) {
    console.error("[MealCycleTemplates] list error:", error);

    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
