import { NextRequest, NextResponse } from "next/server";

import { getTrainerSession } from "@/lib/auth/session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";
import { createFoodSource } from "@/lib/nutrition/food-source/create-food-source";
import { FoodLookupService } from "@/lib/nutrition/food-source/food-lookup-service";
import { SupabaseIngredientRepository } from "@/lib/nutrition/food-source/ingredient-repository";

const LOG_PREFIX = "[Foods Enrich API]";

// POST /api/foods/enrich { id } — lazily fill a cached food's serving data
// (label + weight) from the OFF v2 product API. Idempotent: an already-checked
// row returns without a network call.
export async function POST(request: NextRequest) {
  const correlationId = `req-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  try {
    const session = await getTrainerSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 401 }
      );
    }

    const body = (await request.json().catch(() => null)) as {
      id?: unknown;
    } | null;
    const id = typeof body?.id === "string" ? body.id.trim() : "";

    if (id.length === 0) {
      return NextResponse.json(
        { success: false, error: "id es obligatorio" },
        { status: 400 }
      );
    }

    const service = new FoodLookupService({
      repo: new SupabaseIngredientRepository(createSupabaseClient()),
      source: createFoodSource(),
    });
    const result = await service.enrichServing(session.tenant_host, id);

    if (result === null) {
      return NextResponse.json(
        { success: false, error: "Alimento no encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: result });
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
