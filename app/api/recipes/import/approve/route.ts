import { NextRequest, NextResponse } from "next/server";

import { createSupabaseClient } from "@/lib/clients/supabase-api";
import { RecipeImportService, parseApproveInput } from "@/lib/nutrition/import";
import {
  errorMessage,
  guardRecipeRequest,
} from "@/lib/nutrition/recipes/recipe-request";

const LOG_PREFIX = "[Recipes Import API]";

// POST /api/recipes/import/approve — import approved legacy candidates.
export async function POST(request: NextRequest) {
  const guard = await guardRecipeRequest();

  if (guard.ok === false) {
    return guard.response;
  }

  try {
    const body = await request.json().catch(() => null);
    const parsed = parseApproveInput(body);

    if (parsed.ok === false) {
      return NextResponse.json(
        { success: false, error: parsed.error },
        { status: 400 }
      );
    }

    const service = new RecipeImportService(createSupabaseClient());
    const result = await service.approve(
      guard.session.tenant_host,
      guard.session.trainer_id,
      parsed.value
    );

    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    console.error(`${LOG_PREFIX} approve error:`, {
      correlationId: guard.correlationId,
      error: errorMessage(error),
    });

    return NextResponse.json(
      { success: false, error: "Error inesperado" },
      { status: 500 }
    );
  }
}
