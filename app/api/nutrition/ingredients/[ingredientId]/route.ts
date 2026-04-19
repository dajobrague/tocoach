import { NextRequest, NextResponse } from "next/server";

import { getTrainerSession } from "@/lib/auth/session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";
import { startPerfTimer } from "@/lib/utils/perf-logger";

// PATCH - Update a nutrition ingredient
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ ingredientId: string }> }
) {
  const supabase = createSupabaseClient();
  const timer = startPerfTimer("PATCH /api/nutrition/ingredients/[id]");

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

    const { ingredientId } = await params;
    const body = await request.json();
    const {
      name,
      quantity,
      unit,
      ingredient_order,
      protein,
      carbs,
      fats,
      calories,
    } = body;

    console.log(
      "[Nutrition Ingredients API] Updating ingredient:",
      ingredientId,
      body
    );

    // Verify the ingredient belongs to a meal/day/plan owned by this trainer
    const { data: existingIngredient, error: checkError } = await supabase
      .from("nutrition_ingredients")
      .select("id, nutrition_meal_id")
      .eq("id", ingredientId)
      .single();

    if (checkError || !existingIngredient) {
      console.error(
        "[Nutrition Ingredients API] Ingredient not found:",
        checkError
      );
      timer.end({ ingredient_id: ingredientId, status: 404 });

      return NextResponse.json(
        { success: false, error: "Ingrediente no encontrado" },
        { status: 404 }
      );
    }

    // Verify through meal -> day -> plan -> trainer
    const { data: meal, error: mealError } = await supabase
      .from("nutrition_meals")
      .select("nutrition_day_id")
      .eq("id", existingIngredient.nutrition_meal_id)
      .single();

    if (mealError || !meal) {
      console.error("[Nutrition Ingredients API] Meal not found:", mealError);
      timer.end({ ingredient_id: ingredientId, status: 404 });

      return NextResponse.json(
        { success: false, error: "Comida no encontrada" },
        { status: 404 }
      );
    }

    const { data: day, error: dayError } = await supabase
      .from("nutrition_days")
      .select("nutrition_plan_id")
      .eq("id", meal.nutrition_day_id)
      .single();

    if (dayError || !day) {
      console.error("[Nutrition Ingredients API] Day not found:", dayError);
      timer.end({ ingredient_id: ingredientId, status: 404 });

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
      timer.end({ ingredient_id: ingredientId, status: 403 });

      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 403 }
      );
    }

    // Update the ingredient
    const updateData: any = {};

    if (name !== undefined) updateData.name = name;
    if (quantity !== undefined) updateData.quantity = quantity;
    if (unit !== undefined) updateData.unit = unit;
    if (ingredient_order !== undefined)
      updateData.ingredient_order = ingredient_order;
    if (protein !== undefined) updateData.protein = protein;
    if (carbs !== undefined) updateData.carbs = carbs;
    if (fats !== undefined) updateData.fats = fats;
    if (calories !== undefined) updateData.calories = calories;

    const { data: ingredient, error: updateError } = await supabase
      .from("nutrition_ingredients")
      .update(updateData)
      .eq("id", ingredientId)
      .select()
      .single();

    if (updateError) {
      console.error(
        "[Nutrition Ingredients API] Error updating ingredient:",
        updateError
      );
      timer.end({ ingredient_id: ingredientId, status: 500 });

      return NextResponse.json(
        { success: false, error: "Error al actualizar ingrediente" },
        { status: 500 }
      );
    }

    timer.end({
      ingredient_id: ingredientId,
      fields_updated: Object.keys(updateData).length,
      status: 200,
    });

    return NextResponse.json({
      success: true,
      data: ingredient,
    });
  } catch (error) {
    console.error("[Nutrition Ingredients API] Unexpected error:", error);
    timer.end({ status: 500, unexpected_error: true });

    return NextResponse.json(
      { success: false, error: "Error inesperado" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a nutrition ingredient
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ ingredientId: string }> }
) {
  const supabase = createSupabaseClient();
  const timer = startPerfTimer("DELETE /api/nutrition/ingredients/[id]");

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

    const { ingredientId } = await params;

    console.log(
      "[Nutrition Ingredients API] Deleting ingredient:",
      ingredientId
    );

    // Verify the ingredient belongs to a meal/day/plan owned by this trainer
    const { data: existingIngredient, error: checkError } = await supabase
      .from("nutrition_ingredients")
      .select("id, nutrition_meal_id")
      .eq("id", ingredientId)
      .single();

    if (checkError || !existingIngredient) {
      console.error(
        "[Nutrition Ingredients API] Ingredient not found:",
        checkError
      );
      timer.end({ ingredient_id: ingredientId, status: 404 });

      return NextResponse.json(
        { success: false, error: "Ingrediente no encontrado" },
        { status: 404 }
      );
    }

    // Verify through meal -> day -> plan -> trainer
    const { data: meal, error: mealError } = await supabase
      .from("nutrition_meals")
      .select("nutrition_day_id")
      .eq("id", existingIngredient.nutrition_meal_id)
      .single();

    if (mealError || !meal) {
      console.error("[Nutrition Ingredients API] Meal not found:", mealError);
      timer.end({ ingredient_id: ingredientId, status: 404 });

      return NextResponse.json(
        { success: false, error: "Comida no encontrada" },
        { status: 404 }
      );
    }

    const { data: day, error: dayError } = await supabase
      .from("nutrition_days")
      .select("nutrition_plan_id")
      .eq("id", meal.nutrition_day_id)
      .single();

    if (dayError || !day) {
      console.error("[Nutrition Ingredients API] Day not found:", dayError);
      timer.end({ ingredient_id: ingredientId, status: 404 });

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
      timer.end({ ingredient_id: ingredientId, status: 403 });

      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 403 }
      );
    }

    // Delete the ingredient
    const { error: deleteError } = await supabase
      .from("nutrition_ingredients")
      .delete()
      .eq("id", ingredientId);

    if (deleteError) {
      console.error(
        "[Nutrition Ingredients API] Error deleting ingredient:",
        deleteError
      );
      timer.end({ ingredient_id: ingredientId, status: 500 });

      return NextResponse.json(
        { success: false, error: "Error al eliminar ingrediente" },
        { status: 500 }
      );
    }

    timer.end({ ingredient_id: ingredientId, status: 200 });

    return NextResponse.json({
      success: true,
      message: "Ingrediente eliminado exitosamente",
    });
  } catch (error) {
    console.error("[Nutrition Ingredients API] Unexpected error:", error);
    timer.end({ status: 500, unexpected_error: true });

    return NextResponse.json(
      { success: false, error: "Error inesperado" },
      { status: 500 }
    );
  }
}
