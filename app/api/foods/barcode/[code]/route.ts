import { NextRequest, NextResponse } from "next/server";

import { getTrainerSession } from "@/lib/auth/session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";
import { createFoodSource } from "@/lib/nutrition/food-source/create-food-source";
import { FoodLookupService } from "@/lib/nutrition/food-source/food-lookup-service";
import { SupabaseIngredientRepository } from "@/lib/nutrition/food-source/ingredient-repository";

const LOG_PREFIX = "[Foods Barcode API]";

// GET /api/foods/barcode/<code>
// Trainer-authenticated, tenant-scoped, cache-first barcode lookup.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const correlationId = `req-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  try {
    const session = await getTrainerSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 401 }
      );
    }

    const { code } = await params;
    const trimmedCode = code?.trim() ?? "";

    if (trimmedCode.length === 0) {
      return NextResponse.json(
        { success: false, error: "Se requiere el código" },
        { status: 400 }
      );
    }

    const tenantHost = session.tenant_host;
    const service = new FoodLookupService({
      repo: new SupabaseIngredientRepository(createSupabaseClient()),
      source: createFoodSource(),
    });

    const result = await service.getByBarcode(tenantHost, trimmedCode);

    if (result === null) {
      return NextResponse.json(
        { success: false, error: "Alimento no encontrado" },
        { status: 404 }
      );
    }

    console.log(`${LOG_PREFIX} barcode`, {
      correlationId,
      tenantHost,
      code: trimmedCode,
    });

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
