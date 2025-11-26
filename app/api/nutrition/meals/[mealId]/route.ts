import { NextRequest, NextResponse } from "next/server";

import { getTrainerSession } from "@/lib/auth/session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";

// PATCH - Update a nutrition meal (including macros)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ mealId: string }> }
) {
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

    const { mealId } = await params;
    const body = await request.json();
    const { label, meal_order, notes, protein, carbs, fats, calories } = body;

    console.log("[Nutrition Meals API] Updating meal:", mealId, body);

    // Verify the meal belongs to a day/plan owned by this trainer
    const { data: existingMeal, error: checkError } = await supabase
      .from("nutrition_meals")
      .select("id, nutrition_day_id")
      .eq("id", mealId)
      .single();

    if (checkError || !existingMeal) {
      console.error("[Nutrition Meals API] Meal not found:", checkError);

      return NextResponse.json(
        { success: false, error: "Comida no encontrada" },
        { status: 404 }
      );
    }

    // Verify through day -> plan -> trainer
    const { data: day, error: dayError } = await supabase
      .from("nutrition_days")
      .select("nutrition_plan_id")
      .eq("id", existingMeal.nutrition_day_id)
      .single();

    if (dayError || !day) {
      console.error("[Nutrition Meals API] Day not found:", dayError);

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
        "[Nutrition Meals API] Plan not found or unauthorized:",
        planError
      );

      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 403 }
      );
    }

    // Update the meal
    const updateData: any = {};

    if (label !== undefined) updateData.label = label;
    if (meal_order !== undefined) updateData.meal_order = meal_order;
    if (notes !== undefined) updateData.notes = notes;
    if (protein !== undefined) updateData.protein = protein;
    if (carbs !== undefined) updateData.carbs = carbs;
    if (fats !== undefined) updateData.fats = fats;
    if (calories !== undefined) updateData.calories = calories;

    const { data: meal, error: updateError } = await supabase
      .from("nutrition_meals")
      .update(updateData)
      .eq("id", mealId)
      .select()
      .single();

    if (updateError) {
      console.error("[Nutrition Meals API] Error updating meal:", updateError);

      return NextResponse.json(
        { success: false, error: "Error al actualizar comida" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: meal,
    });
  } catch (error) {
    console.error("[Nutrition Meals API] Unexpected error:", error);

    return NextResponse.json(
      { success: false, error: "Error inesperado" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a nutrition meal
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ mealId: string }> }
) {
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

    const { mealId } = await params;

    console.log("[Nutrition Meals API] Deleting meal:", mealId);

    // Verify the meal belongs to a day/plan owned by this trainer
    const { data: existingMeal, error: checkError } = await supabase
      .from("nutrition_meals")
      .select("id, nutrition_day_id")
      .eq("id", mealId)
      .single();

    if (checkError || !existingMeal) {
      console.error("[Nutrition Meals API] Meal not found:", checkError);

      return NextResponse.json(
        { success: false, error: "Comida no encontrada" },
        { status: 404 }
      );
    }

    // Verify through day -> plan -> trainer
    const { data: day, error: dayError } = await supabase
      .from("nutrition_days")
      .select("nutrition_plan_id")
      .eq("id", existingMeal.nutrition_day_id)
      .single();

    if (dayError || !day) {
      console.error("[Nutrition Meals API] Day not found:", dayError);

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
        "[Nutrition Meals API] Plan not found or unauthorized:",
        planError
      );

      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 403 }
      );
    }

    // Delete the meal (cascades to ingredients)
    const { error: deleteError } = await supabase
      .from("nutrition_meals")
      .delete()
      .eq("id", mealId);

    if (deleteError) {
      console.error("[Nutrition Meals API] Error deleting meal:", deleteError);

      return NextResponse.json(
        { success: false, error: "Error al eliminar comida" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Comida eliminada exitosamente",
    });
  } catch (error) {
    console.error("[Nutrition Meals API] Unexpected error:", error);

    return NextResponse.json(
      { success: false, error: "Error inesperado" },
      { status: 500 }
    );
  }
}
