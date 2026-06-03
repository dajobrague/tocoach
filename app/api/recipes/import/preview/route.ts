import { NextResponse } from "next/server";

import { createSupabaseClient } from "@/lib/clients/supabase-api";
import { RecipeImportService } from "@/lib/nutrition/import";
import {
  errorMessage,
  guardRecipeRequest,
} from "@/lib/nutrition/recipes/recipe-request";

const LOG_PREFIX = "[Recipes Import API]";

// GET /api/recipes/import/preview — legacy recipe candidates for the trainer.
export async function GET() {
  const guard = await guardRecipeRequest();

  if (guard.ok === false) {
    return guard.response;
  }

  try {
    const service = new RecipeImportService(createSupabaseClient());
    const candidates = await service.preview(guard.session.tenant_host);

    return NextResponse.json({ success: true, data: candidates });
  } catch (error) {
    console.error(`${LOG_PREFIX} preview error:`, {
      correlationId: guard.correlationId,
      error: errorMessage(error),
    });

    return NextResponse.json(
      { success: false, error: "Error inesperado" },
      { status: 500 }
    );
  }
}
