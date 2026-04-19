import { NextRequest, NextResponse } from "next/server";

import { getClientSession } from "@/lib/auth/client-session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";
import {
  NUTRITION_TREE_SELECT,
  RawNutritionPlan,
  reshapeNutritionPlan,
} from "@/lib/utils/nutrition-tree";
import { startPerfTimer } from "@/lib/utils/perf-logger";

// GET - Fetch all nutrition plans for the authenticated client with nested
// days, meals, options, and ingredients.
//
// Fase 2: replaced the previous 4-level nested Promise.all (87+ queries per
// plan) with a single Supabase embedded select. Shape returned to the frontend
// is byte-for-byte identical to the pre-Fase-2 response — see
// lib/utils/nutrition-tree.ts for the reshape contract.
export async function GET(_request: NextRequest) {
  const supabase = createSupabaseClient();
  const timer = startPerfTimer("GET /api/client/nutrition");

  try {
    const session = await getClientSession();

    if (!session) {
      timer.end({ status: 401 });

      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 401 }
      );
    }

    const clientId = session.client_id;

    console.log("[Client Nutrition API] Fetching plans for client:", clientId);

    // Single query, four levels of embedded selects. PostgREST expands this
    // into a set of LATERAL joins so we get the full tree in one round-trip.
    // Ordering is applied per level so the response is pre-sorted and the
    // reshape step does no sorting of its own.
    const { data: rawPlans, error: plansError } = await supabase
      .from("nutrition_plans")
      .select(NUTRITION_TREE_SELECT)
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .order("day_order", {
        referencedTable: "nutrition_days",
        ascending: true,
      })
      .order("meal_order", {
        referencedTable: "nutrition_days.nutrition_meals",
        ascending: true,
      })
      .order("option_order", {
        referencedTable:
          "nutrition_days.nutrition_meals.nutrition_meal_options",
        ascending: true,
      })
      .order("ingredient_order", {
        referencedTable:
          "nutrition_days.nutrition_meals.nutrition_meal_options.nutrition_ingredients",
        ascending: true,
      });

    if (plansError) {
      console.error("[Client Nutrition API] Error fetching plans:", plansError);
      timer.end({ client_id: clientId, status: 500 });

      return NextResponse.json(
        { success: false, error: "Error al obtener planes nutricionales" },
        { status: 500 }
      );
    }

    const plansWithData = (
      (rawPlans ?? []) as unknown as RawNutritionPlan[]
    ).map((plan) => reshapeNutritionPlan(plan, "client"));

    timer.end({
      client_id: clientId,
      plans: plansWithData.length,
      status: 200,
    });

    return NextResponse.json({
      success: true,
      data: plansWithData,
    });
  } catch (error) {
    console.error("[Client Nutrition API] Unexpected error:", error);
    timer.end({ status: 500, unexpected_error: true });

    return NextResponse.json(
      { success: false, error: "Error inesperado" },
      { status: 500 }
    );
  }
}
