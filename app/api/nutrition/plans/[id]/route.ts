import { NextRequest, NextResponse } from "next/server";

import { getTrainerSession } from "@/lib/auth/session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";

// GET - Fetch all nutrition plans for a client with nested days, meals, and ingredients
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    const { id: clientId } = await params;

    console.log("[Nutrition Plans API] Fetching plans for client:", clientId);

    // Get nutrition plans for this client
    const { data: plans, error: plansError } = await supabase
      .from("nutrition_plans")
      .select("*")
      .eq("client_id", clientId)
      .eq("trainer_id", session.trainer_id)
      .order("created_at", { ascending: false });

    if (plansError) {
      console.error("[Nutrition Plans API] Error fetching plans:", plansError);

      return NextResponse.json(
        { success: false, error: "Error al obtener planes nutricionales" },
        { status: 500 }
      );
    }

    // For each plan, get nested days, meals, and ingredients
    const plansWithData = await Promise.all(
      (plans || []).map(async (plan) => {
        // Get days for this plan
        const { data: days, error: daysError } = await supabase
          .from("nutrition_days")
          .select("*")
          .eq("nutrition_plan_id", plan.id)
          .order("day_order", { ascending: true });

        if (daysError) {
          console.error(
            "[Nutrition Plans API] Error fetching days:",
            daysError
          );

          return { ...plan, days: [] };
        }

        // For each day, get meals with ingredients
        const daysWithMeals = await Promise.all(
          (days || []).map(async (day) => {
            // Get meals for this day
            const { data: meals, error: mealsError } = await supabase
              .from("nutrition_meals")
              .select("*")
              .eq("nutrition_day_id", day.id)
              .order("meal_order", { ascending: true });

            if (mealsError) {
              console.error(
                "[Nutrition Plans API] Error fetching meals:",
                mealsError
              );

              return { ...day, meals: [] };
            }

            // For each meal, get ingredients
            const mealsWithIngredients = await Promise.all(
              (meals || []).map(async (meal) => {
                const { data: ingredients, error: ingredientsError } =
                  await supabase
                    .from("nutrition_ingredients")
                    .select("*")
                    .eq("nutrition_meal_id", meal.id)
                    .order("ingredient_order", { ascending: true });

                if (ingredientsError) {
                  console.error(
                    "[Nutrition Plans API] Error fetching ingredients:",
                    ingredientsError
                  );

                  return { ...meal, ingredients: [] };
                }

                return { ...meal, ingredients: ingredients || [] };
              })
            );

            return { ...day, meals: mealsWithIngredients };
          })
        );

        return { ...plan, days: daysWithMeals };
      })
    );

    return NextResponse.json({
      success: true,
      data: plansWithData,
    });
  } catch (error) {
    console.error("[Nutrition Plans API] Unexpected error:", error);

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

  try {
    // Authenticate trainer
    const session = await getTrainerSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 401 }
      );
    }

    const { id: planId } = await params;
    const body = await request.json();
    const { name, start_date, status, notes } = body;

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

    const { data: plan, error: updateError } = await supabase
      .from("nutrition_plans")
      .update(updateData)
      .eq("id", planId)
      .select()
      .single();

    if (updateError) {
      console.error("[Nutrition Plans API] Error updating plan:", updateError);

      return NextResponse.json(
        { success: false, error: "Error al actualizar plan nutricional" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: plan,
    });
  } catch (error) {
    console.error("[Nutrition Plans API] Unexpected error:", error);

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

  try {
    // Authenticate trainer
    const session = await getTrainerSession();

    if (!session) {
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

      return NextResponse.json(
        { success: false, error: "Error al eliminar plan nutricional" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Plan eliminado exitosamente",
    });
  } catch (error) {
    console.error("[Nutrition Plans API] Unexpected error:", error);

    return NextResponse.json(
      { success: false, error: "Error inesperado" },
      { status: 500 }
    );
  }
}
