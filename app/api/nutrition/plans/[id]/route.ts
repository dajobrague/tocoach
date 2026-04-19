import { NextRequest, NextResponse } from "next/server";

import { getTrainerSession } from "@/lib/auth/session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";
import {
  NUTRITION_TREE_SELECT,
  RawNutritionPlan,
  reshapeNutritionPlan,
} from "@/lib/utils/nutrition-tree";
import { startPerfTimer } from "@/lib/utils/perf-logger";

// GET - Fetch all nutrition plans for a client with nested days, meals,
// options, and ingredients.
//
// Fase 2: replaced the previous 4-level nested Promise.all (87+ queries per
// plan) with a single Supabase embedded select. Shape returned to the frontend
// is byte-for-byte identical to the pre-Fase-2 response — see
// lib/utils/nutrition-tree.ts for the reshape contract. The "trainer" variant
// preserves the untouched plan-level columns and meal.image_url pass-through
// that this endpoint returned before Fase 2.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = createSupabaseClient();
  const timer = startPerfTimer("GET /api/nutrition/plans/[id]");

  try {
    // Authenticate trainer
    const session = await getTrainerSession();

    if (!session) {
      timer.end({ status: 401 });

      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 401 }
      );
    }

    const { id: clientId } = await params;

    console.log("[Nutrition Plans API] Fetching plans for client:", clientId);

    // Single query: plan → days → meals → options → ingredients.
    const { data: rawPlans, error: plansError } = await supabase
      .from("nutrition_plans")
      .select(NUTRITION_TREE_SELECT)
      .eq("client_id", clientId)
      .eq("trainer_id", session.trainer_id)
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
      console.error("[Nutrition Plans API] Error fetching plans:", plansError);
      timer.end({ client_id: clientId, status: 500 });

      return NextResponse.json(
        { success: false, error: "Error al obtener planes nutricionales" },
        { status: 500 }
      );
    }

    const plansWithData = (
      (rawPlans ?? []) as unknown as RawNutritionPlan[]
    ).map((plan) => reshapeNutritionPlan(plan, "trainer"));

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
    console.error("[Nutrition Plans API] Unexpected error:", error);
    timer.end({ status: 500, unexpected_error: true });

    return NextResponse.json(
      { success: false, error: "Error inesperado" },
      { status: 500 }
    );
  }
}

// PATCH - Update a nutrition plan
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = createSupabaseClient();
  const timer = startPerfTimer("PATCH /api/nutrition/plans/[id]");

  try {
    // Authenticate trainer
    const session = await getTrainerSession();

    if (!session) {
      timer.end({ status: 401 });

      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 401 }
      );
    }

    const { id: planId } = await params;
    const body = await request.json();
    const {
      name,
      start_date,
      status,
      notes,
      show_meal_images,
      show_calories,
      plan_mode,
    } = body;

    console.log("[Nutrition Plans API] Updating plan:", planId, body);

    // Verify the plan belongs to this trainer
    const { data: existingPlan, error: checkError } = await supabase
      .from("nutrition_plans")
      .select("id")
      .eq("id", planId)
      .eq("trainer_id", session.trainer_id)
      .single();

    if (checkError || !existingPlan) {
      console.error(
        "[Nutrition Plans API] Plan not found or unauthorized:",
        checkError
      );
      timer.end({ plan_id: planId, status: 404 });

      return NextResponse.json(
        { success: false, error: "Plan no encontrado o no autorizado" },
        { status: 404 }
      );
    }

    // Update the plan
    const updateData: any = {};

    if (name !== undefined) updateData.name = name;
    if (start_date !== undefined) updateData.start_date = start_date;
    if (status !== undefined) updateData.status = status;
    if (notes !== undefined) updateData.notes = notes;
    if (show_meal_images !== undefined)
      updateData.show_meal_images = Boolean(show_meal_images);
    // Item 2.3: plan-level calorie visibility toggle.
    if (show_calories !== undefined)
      updateData.show_calories = Boolean(show_calories);

    if (plan_mode !== undefined) {
      if (!["structured", "pdf", "hybrid"].includes(plan_mode)) {
        timer.end({ plan_id: planId, status: 400 });

        return NextResponse.json(
          { success: false, error: "Modo de plan no válido" },
          { status: 400 }
        );
      }
      updateData.plan_mode = plan_mode;
    }

    if (Object.keys(updateData).length === 0) {
      timer.end({ plan_id: planId, status: 400 });

      return NextResponse.json(
        { success: false, error: "No hay campos para actualizar" },
        { status: 400 }
      );
    }

    const { data: plan, error: updateError } = await supabase
      .from("nutrition_plans")
      .update(updateData)
      .eq("id", planId)
      .select()
      .single();

    if (updateError) {
      console.error("[Nutrition Plans API] Error updating plan:", updateError);
      timer.end({ plan_id: planId, status: 500 });

      return NextResponse.json(
        { success: false, error: "Error al actualizar plan nutricional" },
        { status: 500 }
      );
    }

    timer.end({ plan_id: planId, status: 200 });

    return NextResponse.json({
      success: true,
      data: plan,
    });
  } catch (error) {
    console.error("[Nutrition Plans API] Unexpected error:", error);
    timer.end({ status: 500, unexpected_error: true });

    return NextResponse.json(
      { success: false, error: "Error inesperado" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a nutrition plan
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = createSupabaseClient();
  const timer = startPerfTimer("DELETE /api/nutrition/plans/[id]");

  try {
    // Authenticate trainer
    const session = await getTrainerSession();

    if (!session) {
      timer.end({ status: 401 });

      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 401 }
      );
    }

    const { id: planId } = await params;

    console.log("[Nutrition Plans API] Deleting plan:", planId);

    // Verify the plan belongs to this trainer
    const { data: existingPlan, error: checkError } = await supabase
      .from("nutrition_plans")
      .select("id")
      .eq("id", planId)
      .eq("trainer_id", session.trainer_id)
      .single();

    if (checkError || !existingPlan) {
      console.error(
        "[Nutrition Plans API] Plan not found or unauthorized:",
        checkError
      );
      timer.end({ plan_id: planId, status: 404 });

      return NextResponse.json(
        { success: false, error: "Plan no encontrado o no autorizado" },
        { status: 404 }
      );
    }

    // Delete the plan (cascades to days, meals, and ingredients)
    const { error: deleteError } = await supabase
      .from("nutrition_plans")
      .delete()
      .eq("id", planId);

    if (deleteError) {
      console.error("[Nutrition Plans API] Error deleting plan:", deleteError);
      timer.end({ plan_id: planId, status: 500 });

      return NextResponse.json(
        { success: false, error: "Error al eliminar plan nutricional" },
        { status: 500 }
      );
    }

    timer.end({ plan_id: planId, status: 200 });

    return NextResponse.json({
      success: true,
      message: "Plan eliminado exitosamente",
    });
  } catch (error) {
    console.error("[Nutrition Plans API] Unexpected error:", error);
    timer.end({ status: 500, unexpected_error: true });

    return NextResponse.json(
      { success: false, error: "Error inesperado" },
      { status: 500 }
    );
  }
}
