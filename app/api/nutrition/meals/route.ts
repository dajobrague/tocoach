import { NextRequest, NextResponse } from "next/server";

import { getTrainerSession } from "@/lib/auth/session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";

// POST - Create a new nutrition meal
export async function POST(request: NextRequest) {
  const supabase = createSupabaseClient();

  try {
    // Authenticate trainer
    const session = await getTrainerSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      nutrition_day_id,
      label,
      meal_order,
      notes,
      protein,
      carbs,
      fats,
      calories,
    } = body;

    console.log("[Nutrition Meals API] Creating meal:", body);

    // Verify the day belongs to a plan owned by this trainer and get tenant_host
    const { data: day, error: dayError } = await supabase
      .from("nutrition_days")
      .select("id, nutrition_plan_id, tenant_host")
      .eq("id", nutrition_day_id)
      .single();

    if (dayError || !day) {
      console.error("[Nutrition Meals API] Day not found:", dayError);

      return NextResponse.json(
        { success: false, error: "Día no encontrado" },
        { status: 404 }
      );
    }

    // Verify the plan belongs to this trainer
    const { data: plan, error: planError } = await supabase
      .from("nutrition_plans")
      .select("id")
      .eq("id", day.nutrition_plan_id)
      .eq("trainer_id", session.trainer_id)
      .single();

    if (planError || !plan) {
      console.error(
        "[Nutrition Meals API] Plan not found or unauthorized:",
        planError
      );

      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 403 }
      );
    }

    // Get the current max meal_order for this day if not provided
    let orderToUse = meal_order;

    if (orderToUse === undefined) {
      const { data: existingMeals } = await supabase
        .from("nutrition_meals")
        .select("meal_order")
        .eq("nutrition_day_id", nutrition_day_id)
        .order("meal_order", { ascending: false })
        .limit(1);

      orderToUse =
        existingMeals && existingMeals.length > 0 && existingMeals[0]
          ? existingMeals[0].meal_order + 1
          : 0;
    }

    // Create the nutrition meal
    const { data: meal, error: mealError } = await supabase
      .from("nutrition_meals")
      .insert({
        nutrition_day_id,
        tenant_host: day.tenant_host,
        label,
        meal_order: orderToUse,
        notes,
        protein: protein || 0,
        carbs: carbs || 0,
        fats: fats || 0,
        calories: calories || 0,
      })
      .select()
      .single();

    if (mealError) {
      console.error("[Nutrition Meals API] Error creating meal:", mealError);

      return NextResponse.json(
        { success: false, error: "Error al crear comida" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { ...meal, ingredients: [] },
    });
  } catch (error) {
    console.error("[Nutrition Meals API] Unexpected error:", error);

    return NextResponse.json(
      { success: false, error: "Error inesperado" },
      { status: 500 }
    );
  }
}
