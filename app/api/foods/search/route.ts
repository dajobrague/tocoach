import { NextRequest, NextResponse } from "next/server";

import { getTrainerSession } from "@/lib/auth/session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";
import { SupabaseCommonFoodsRepository } from "@/lib/nutrition/food-source/common-foods-repository";
import { createFoodSource } from "@/lib/nutrition/food-source/create-food-source";
import { FoodLookupService } from "@/lib/nutrition/food-source/food-lookup-service";
import { SupabaseIngredientRepository } from "@/lib/nutrition/food-source/ingredient-repository";

const LOG_PREFIX = "[Foods Search API]";

// GET /api/foods/search?q=<query>&locale=<locale>
// Trainer-authenticated, tenant-scoped, cache-first food search.
// (Per-trainer feature-flag gating arrives in P0-T5; auth is the gate today.)
export async function GET(request: NextRequest) {
  const correlationId = `req-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  try {
    const session = await getTrainerSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim() ?? "";

    if (q.length === 0) {
      return NextResponse.json(
        { success: false, error: "Se requiere el parámetro q" },
        { status: 400 }
      );
    }

    const localeParam = searchParams.get("locale")?.trim();
    const locale =
      localeParam !== undefined && localeParam.length > 0
        ? localeParam
        : undefined;

    const tenantHost = session.tenant_host;
    const supabase = createSupabaseClient();
    const service = new FoodLookupService({
      repo: new SupabaseIngredientRepository(supabase),
      source: createFoodSource(),
      commonFoods: new SupabaseCommonFoodsRepository(supabase),
    });

    const results = await service.search(tenantHost, q, locale);

    console.log(`${LOG_PREFIX} search`, {
      correlationId,
      tenantHost,
      q,
      count: results.length,
    });

    return NextResponse.json({ success: true, data: results });
  } catch (error) {
    console.error(`${LOG_PREFIX} Unexpected error:`, {
      correlationId,
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { success: false, error: "Error inesperado" },
      { status: 500 }
    );
  }
}
