import { NextRequest, NextResponse } from "next/server";

import { getTrainerSession } from "@/lib/auth/session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";

// POST - Create a new meal option
export async function POST(request: NextRequest) {
  const supabase = createSupabaseClient();

  try {
    const session = await getTrainerSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const mealId = body.mealId ?? body.meal_id;
    const name = body.name;

    if (!mealId || typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: "Se requiere mealId y name válidos",
        },
        { status: 400 }
      );
    }

    const { data: meal, error: mealError } = await supabase
      .from("nutrition_meals")
      .select("id, nutrition_day_id")
      .eq("id", mealId)
      .single();

    if (mealError || !meal) {
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
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 403 }
      );
    }

    const { data: existingOptions, error: optListError } = await supabase
      .from("nutrition_meal_options")
      .select("option_order")
      .eq("meal_id", mealId)
      .order("option_order", { ascending: false })
      .limit(1);

    if (optListError) {
      console.error(
        "[Nutrition Options API] Error listing options:",
        optListError
      );

      return NextResponse.json(
        { success: false, error: "Error al obtener opciones de la comida" },
        { status: 500 }
      );
    }

    const nextOrder =
      existingOptions &&
      existingOptions.length > 0 &&
      existingOptions[0]?.option_order != null
        ? existingOptions[0].option_order + 1
        : 1;

    const { data: option, error: insertError } = await supabase
      .from("nutrition_meal_options")
      .insert({
        meal_id: mealId,
        name: name.trim(),
        option_order: nextOrder,
        protein: null,
        carbs: null,
        fats: null,
        calories: null,
        image_url: null,
      })
      .select()
      .single();

    if (insertError || !option) {
      console.error(
        "[Nutrition Options API] Error creating option:",
        insertError
      );

      return NextResponse.json(
        { success: false, error: "Error al crear opción" },
        { status: 500 }
      );
    }

    const { count, error: countError } = await supabase
      .from("nutrition_meal_options")
      .select("*", { count: "exact", head: true })
      .eq("meal_id", mealId);

    if (!countError && count != null && count > 1) {
      await supabase
        .from("nutrition_meals")
        .update({ has_alternatives: true })
        .eq("id", mealId);
    }

    return NextResponse.json({
      success: true,
      data: option,
    });
  } catch (error) {
    console.error("[Nutrition Options API] Unexpected error:", error);

    return NextResponse.json(
      { success: false, error: "Error inesperado" },
      { status: 500 }
    );
  }
}
