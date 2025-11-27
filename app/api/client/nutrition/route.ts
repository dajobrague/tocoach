import { NextRequest, NextResponse } from "next/server";

import { getClientSession } from "@/lib/auth/client-session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";

// GET - Fetch all nutrition plans for the authenticated client with nested days, meals, and ingredients
export async function GET(request: NextRequest) {
  const supabase = createSupabaseClient();

  try {
    // Authenticate client
    const session = await getClientSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 401 }
      );
    }

    const clientId = session.client_id;

    console.log("[Client Nutrition API] Fetching plans for client:", clientId);

    // Get nutrition plans for this client
    const { data: plans, error: plansError } = await supabase
      .from("nutrition_plans")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });

    if (plansError) {
      console.error("[Client Nutrition API] Error fetching plans:", plansError);

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
            "[Client Nutrition API] Error fetching days:",
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
                "[Client Nutrition API] Error fetching meals:",
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
                    "[Client Nutrition API] Error fetching ingredients:",
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
    console.error("[Client Nutrition API] Unexpected error:", error);

    return NextResponse.json(
      { success: false, error: "Error inesperado" },
      { status: 500 }
    );
  }
}
