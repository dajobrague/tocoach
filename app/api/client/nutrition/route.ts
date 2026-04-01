import { NextRequest, NextResponse } from "next/server";

import { getClientSession } from "@/lib/auth/client-session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";

// GET - Fetch all nutrition plans for the authenticated client with nested days, meals, options, and ingredients
export async function GET(request: NextRequest) {
  const supabase = createSupabaseClient();

  try {
    const session = await getClientSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 401 }
      );
    }

    const clientId = session.client_id;

    console.log("[Client Nutrition API] Fetching plans for client:", clientId);

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

    const plansWithData = await Promise.all(
      (plans || []).map(async (plan) => {
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

        const daysWithMeals = await Promise.all(
          (days || []).map(async (day) => {
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

            const mealsWithOptions = await Promise.all(
              (meals || []).map(async (meal) => {
                const { data: options, error: optionsError } = await supabase
                  .from("nutrition_meal_options")
                  .select("*")
                  .eq("meal_id", meal.id)
                  .order("option_order", { ascending: true });

                if (optionsError) {
                  console.error(
                    "[Client Nutrition API] Error fetching meal options:",
                    optionsError
                  );

                  return {
                    ...meal,
                    image_url: meal.image_url ?? null,
                    has_alternatives: meal.has_alternatives ?? false,
                    options: [],
                    ingredients: [],
                  };
                }

                const optionsWithIngredients = await Promise.all(
                  (options || []).map(async (opt) => {
                    const { data: ingredients, error: ingredientsError } =
                      await supabase
                        .from("nutrition_ingredients")
                        .select("*")
                        .eq("option_id", opt.id)
                        .order("ingredient_order", { ascending: true });

                    if (ingredientsError) {
                      console.error(
                        "[Client Nutrition API] Error fetching ingredients:",
                        ingredientsError
                      );

                      return { ...opt, ingredients: [] };
                    }

                    return {
                      ...opt,
                      ingredients: ingredients || [],
                    };
                  })
                );

                const ingredients = optionsWithIngredients.flatMap(
                  (opt) => opt.ingredients
                );

                return {
                  ...meal,
                  image_url: meal.image_url ?? null,
                  has_alternatives: meal.has_alternatives ?? false,
                  options: optionsWithIngredients,
                  ingredients,
                };
              })
            );

            return { ...day, meals: mealsWithOptions };
          })
        );

        return {
          ...plan,
          plan_mode: plan.plan_mode ?? "structured",
          pdf_url: plan.pdf_url ?? null,
          pdf_name: plan.pdf_name ?? null,
          show_meal_images: plan.show_meal_images !== false,
          days: daysWithMeals,
        };
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
