import { NextRequest, NextResponse } from "next/server";

import { getTrainerSession } from "@/lib/auth/session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";

// POST - Create a new nutrition ingredient
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
      nutrition_meal_id,
      name,
      quantity,
      unit,
      ingredient_order,
      protein,
      carbs,
      fats,
      calories,
    } = body;

    console.log("[Nutrition Ingredients API] Creating ingredient:", body);

    // Verify the meal belongs to a day/plan owned by this trainer and get tenant_host
    const { data: meal, error: mealError } = await supabase
      .from("nutrition_meals")
      .select("id, nutrition_day_id, tenant_host")
      .eq("id", nutrition_meal_id)
      .single();

    if (mealError || !meal) {
      console.error("[Nutrition Ingredients API] Meal not found:", mealError);

      return NextResponse.json(
        { success: false, error: "Comida no encontrada" },
        { status: 404 }
      );
    }

    // Verify through day -> plan -> trainer
    const { data: day, error: dayError } = await supabase
      .from("nutrition_days")
      .select("nutrition_plan_id")
      .eq("id", meal.nutrition_day_id)
      .single();

    if (dayError || !day) {
      console.error("[Nutrition Ingredients API] Day not found:", dayError);

      return NextResponse.json(
        { success: false, error: "Día no encontrado" },
        { status: 404 }
      );
    }

    const { data: plan, error: planError } = await supabase
      .from("nutrition_plans")
      .select("id")
      .eq("id", day.nutrition_plan_id)
      .eq("trainer_id", session.trainer_id)
      .single();

    if (planError || !plan) {
      console.error(
        "[Nutrition Ingredients API] Plan not found or unauthorized:",
        planError
      );

      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 403 }
      );
    }

    // Get the current max ingredient_order for this meal if not provided
    let orderToUse = ingredient_order;

    if (orderToUse === undefined) {
      const { data: existingIngredients } = await supabase
        .from("nutrition_ingredients")
        .select("ingredient_order")
        .eq("nutrition_meal_id", nutrition_meal_id)
        .order("ingredient_order", { ascending: false })
        .limit(1);

      orderToUse =
        existingIngredients &&
        existingIngredients.length > 0 &&
        existingIngredients[0]
          ? existingIngredients[0].ingredient_order + 1
          : 0;
    }

    // Create the nutrition ingredient
    const { data: ingredient, error: ingredientError } = await supabase
      .from("nutrition_ingredients")
      .insert({
        nutrition_meal_id,
        tenant_host: meal.tenant_host,
        name,
        quantity,
        unit,
        ingredient_order: orderToUse,
        protein,
        carbs,
        fats,
        calories,
      })
      .select()
      .single();

    if (ingredientError) {
      console.error(
        "[Nutrition Ingredients API] Error creating ingredient:",
        ingredientError
      );

      return NextResponse.json(
        { success: false, error: "Error al crear ingrediente" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: ingredient,
    });
  } catch (error) {
    console.error("[Nutrition Ingredients API] Unexpected error:", error);

    return NextResponse.json(
      { success: false, error: "Error inesperado" },
      { status: 500 }
    );
  }
}
