import { NextRequest, NextResponse } from "next/server";

import { getTrainerSession } from "@/lib/auth/session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";

// POST - Create a new nutrition ingredient (under an option)
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
    const {
      optionId,
      option_id: option_id_snake,
      nutrition_meal_id,
      mealId,
      name,
      quantity,
      unit,
      ingredient_order,
      protein,
      carbs,
      fats,
      calories,
    } = body;

    const explicitOptionId = optionId ?? option_id_snake;
    const legacyMealId = nutrition_meal_id ?? mealId;

    if (!explicitOptionId && !legacyMealId) {
      return NextResponse.json(
        {
          success: false,
          error: "Se requiere optionId o nutrition_meal_id",
        },
        { status: 400 }
      );
    }

    let resolvedOptionId: string;
    let mealIdForIngredient: string;
    let tenantHost: string;

    if (explicitOptionId) {
      const { data: optionRow, error: optError } = await supabase
        .from("nutrition_meal_options")
        .select("id, meal_id")
        .eq("id", explicitOptionId)
        .single();

      if (optError || !optionRow) {
        return NextResponse.json(
          { success: false, error: "Opción no encontrada" },
          { status: 404 }
        );
      }

      const { data: meal, error: mealError } = await supabase
        .from("nutrition_meals")
        .select("id, nutrition_day_id, tenant_host")
        .eq("id", optionRow.meal_id)
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

      resolvedOptionId = optionRow.id;
      mealIdForIngredient = meal.id;
      tenantHost = meal.tenant_host;
    } else {
      const { data: meal, error: mealError } = await supabase
        .from("nutrition_meals")
        .select("id, nutrition_day_id, tenant_host")
        .eq("id", legacyMealId)
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

      const { data: firstOptions, error: foError } = await supabase
        .from("nutrition_meal_options")
        .select("id")
        .eq("meal_id", legacyMealId)
        .order("option_order", { ascending: true })
        .limit(1);

      if (foError || !firstOptions?.length) {
        return NextResponse.json(
          {
            success: false,
            error: "La comida no tiene ninguna opción",
          },
          { status: 404 }
        );
      }

      const firstOpt = firstOptions[0];

      if (!firstOpt) {
        return NextResponse.json(
          {
            success: false,
            error: "La comida no tiene ninguna opción",
          },
          { status: 404 }
        );
      }

      resolvedOptionId = firstOpt.id;
      mealIdForIngredient = meal.id;
      tenantHost = meal.tenant_host;
    }

    let orderToUse = ingredient_order;

    if (orderToUse === undefined) {
      const { data: existingIngredients } = await supabase
        .from("nutrition_ingredients")
        .select("ingredient_order")
        .eq("option_id", resolvedOptionId)
        .order("ingredient_order", { ascending: false })
        .limit(1);

      orderToUse =
        existingIngredients &&
        existingIngredients.length > 0 &&
        existingIngredients[0]
          ? existingIngredients[0].ingredient_order + 1
          : 0;
    }

    const { data: ingredient, error: ingredientError } = await supabase
      .from("nutrition_ingredients")
      .insert({
        nutrition_meal_id: mealIdForIngredient,
        option_id: resolvedOptionId,
        tenant_host: tenantHost,
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
