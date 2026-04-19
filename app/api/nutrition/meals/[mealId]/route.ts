import { NextRequest, NextResponse } from "next/server";

import { getTrainerSession } from "@/lib/auth/session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";

async function assertMealTrainerAccess(
  supabase: ReturnType<typeof createSupabaseClient>,
  trainerId: string,
  mealId: string
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const { data: existingMeal, error: checkError } = await supabase
    .from("nutrition_meals")
    .select("id, nutrition_day_id")
    .eq("id", mealId)
    .single();

  if (checkError || !existingMeal) {
    return { ok: false, status: 404, error: "Comida no encontrada" };
  }

  const { data: day, error: dayError } = await supabase
    .from("nutrition_days")
    .select("nutrition_plan_id")
    .eq("id", existingMeal.nutrition_day_id)
    .single();

  if (dayError || !day) {
    return { ok: false, status: 404, error: "Día no encontrado" };
  }

  const { data: plan, error: planError } = await supabase
    .from("nutrition_plans")
    .select("id")
    .eq("id", day.nutrition_plan_id)
    .eq("trainer_id", trainerId)
    .single();

  if (planError || !plan) {
    return { ok: false, status: 403, error: "No autorizado" };
  }

  return { ok: true };
}

// GET - Meal with options and nested ingredients (+ flattened ingredients)
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ mealId: string }> }
) {
  const supabase = createSupabaseClient();

  try {
    const session = await getTrainerSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 401 }
      );
    }

    const { mealId } = await params;
    const access = await assertMealTrainerAccess(
      supabase,
      session.trainer_id,
      mealId
    );

    if (!access.ok) {
      return NextResponse.json(
        { success: false, error: access.error },
        { status: access.status }
      );
    }

    const { data: meal, error: mealError } = await supabase
      .from("nutrition_meals")
      .select("*")
      .eq("id", mealId)
      .single();

    if (mealError || !meal) {
      return NextResponse.json(
        { success: false, error: "Comida no encontrada" },
        { status: 404 }
      );
    }

    const { data: options, error: optionsError } = await supabase
      .from("nutrition_meal_options")
      .select("*")
      .eq("meal_id", mealId)
      .order("option_order", { ascending: true });

    if (optionsError) {
      console.error(
        "[Nutrition Meals API] Error fetching options:",
        optionsError
      );

      return NextResponse.json(
        { success: false, error: "Error al obtener opciones de la comida" },
        { status: 500 }
      );
    }

    const optionsWithIngredients = await Promise.all(
      (options || []).map(async (opt) => {
        const { data: ingredients, error: ingError } = await supabase
          .from("nutrition_ingredients")
          .select("*")
          .eq("option_id", opt.id)
          .order("ingredient_order", { ascending: true });

        if (ingError) {
          console.error(
            "[Nutrition Meals API] Error fetching ingredients:",
            ingError
          );

          return { ...opt, ingredients: [] };
        }

        return { ...opt, ingredients: ingredients || [] };
      })
    );

    const ingredients = optionsWithIngredients.flatMap((o) => o.ingredients);

    return NextResponse.json({
      success: true,
      data: {
        ...meal,
        options: optionsWithIngredients,
        ingredients,
      },
    });
  } catch (error) {
    console.error("[Nutrition Meals API] Unexpected error:", error);

    return NextResponse.json(
      { success: false, error: "Error inesperado" },
      { status: 500 }
    );
  }
}

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
    const {
      label,
      meal_order,
      notes,
      protein,
      carbs,
      fats,
      calories,
      show_calories,
    } = body;

    console.log("[Nutrition Meals API] Updating meal:", mealId, body);

    const access = await assertMealTrainerAccess(
      supabase,
      session.trainer_id,
      mealId
    );

    if (!access.ok) {
      return NextResponse.json(
        { success: false, error: access.error },
        { status: access.status }
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
    // Item 2.3: per-meal calorie visibility override.
    //  null  → inherit from plan (default)
    //  true  → force show
    //  false → force hide
    if (show_calories !== undefined)
      updateData.show_calories =
        show_calories === null ? null : Boolean(show_calories);

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

    const access = await assertMealTrainerAccess(
      supabase,
      session.trainer_id,
      mealId
    );

    if (!access.ok) {
      return NextResponse.json(
        { success: false, error: access.error },
        { status: access.status }
      );
    }

    // Delete the meal (cascades to options and ingredients)
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
