/* eslint-disable no-console */
import { NextRequest, NextResponse } from "next/server";

import { getTrainerSession } from "@/lib/auth/session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";

// POST - Create a new nutrition plan
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
      client_id,
      name,
      start_date,
      status,
      notes,
      templateId,
      is_template,
    } = body;

    console.log("[Nutrition Plans API] Creating plan:", body);

    // Get tenant_host for the trainer
    const { data: tenant } = await supabase
      .from("tenants")
      .select("host")
      .eq("trainer_id", session.trainer_id)
      .single();

    if (!tenant) {
      return NextResponse.json(
        { success: false, error: "Tenant no encontrado" },
        { status: 404 }
      );
    }

    let plan: any;

    // If templateId is provided, clone from template
    if (templateId) {
      console.log("[Nutrition Plans API] Creating from template:", templateId);

      // Fetch the template
      const { data: template, error: templateError } = await supabase
        .from("nutrition_plans")
        .select("*")
        .eq("id", templateId)
        .eq("trainer_id", session.trainer_id)
        .eq("is_template", true)
        .single();

      if (templateError || !template) {
        console.error(
          "[Nutrition Plans API] Template not found:",
          templateError
        );

        return NextResponse.json(
          { success: false, error: "Plantilla no encontrada" },
          { status: 404 }
        );
      }

      // Create the plan from template
      const { data: newPlan, error: planError } = await supabase
        .from("nutrition_plans")
        .insert({
          tenant_host: tenant.host,
          client_id,
          trainer_id: session.trainer_id,
          name,
          start_date: start_date || new Date().toISOString().split("T")[0],
          status: status || "active",
          notes: notes || template.notes,
          is_template: false,
          show_meal_images:
            template.show_meal_images !== undefined
              ? Boolean(template.show_meal_images)
              : true,
        })
        .select()
        .single();

      if (planError || !newPlan) {
        console.error(
          "[Nutrition Plans API] Error creating plan from template:",
          planError
        );

        return NextResponse.json(
          { success: false, error: "Error al crear plan desde plantilla" },
          { status: 500 }
        );
      }

      plan = newPlan;

      // Clone days from template
      const { data: templateDays } = await supabase
        .from("nutrition_days")
        .select("*")
        .eq("nutrition_plan_id", templateId)
        .order("day_order", { ascending: true });

      if (templateDays && templateDays.length > 0) {
        for (const templateDay of templateDays) {
          // Create new day
          const { data: newDay, error: dayError } = await supabase
            .from("nutrition_days")
            .insert({
              tenant_host: tenant.host,
              nutrition_plan_id: plan.id,
              day_label: templateDay.day_label,
              day_order: templateDay.day_order,
              protein: templateDay.protein || 0,
              carbs: templateDay.carbs || 0,
              fats: templateDay.fats || 0,
              calories: templateDay.calories || 0,
              weekdays: templateDay.weekdays || [],
            })
            .select()
            .single();

          if (dayError || !newDay) {
            console.error("[Nutrition Plans API] Error cloning day:", dayError);
            continue;
          }

          // Clone meals for this day
          const { data: templateMeals } = await supabase
            .from("nutrition_meals")
            .select("*")
            .eq("nutrition_day_id", templateDay.id)
            .order("meal_order", { ascending: true });

          if (templateMeals && templateMeals.length > 0) {
            for (const templateMeal of templateMeals) {
              // Create new meal
              const { data: newMeal, error: mealError } = await supabase
                .from("nutrition_meals")
                .insert({
                  tenant_host: tenant.host,
                  nutrition_day_id: newDay.id,
                  label: templateMeal.label,
                  meal_order: templateMeal.meal_order,
                  notes: templateMeal.notes,
                  protein: templateMeal.protein || 0,
                  carbs: templateMeal.carbs || 0,
                  fats: templateMeal.fats || 0,
                  calories: templateMeal.calories || 0,
                  image_url: templateMeal.image_url ?? null,
                  has_alternatives: templateMeal.has_alternatives ?? false,
                })
                .select()
                .single();

              if (mealError || !newMeal) {
                console.error(
                  "[Nutrition Plans API] Error cloning meal:",
                  mealError
                );
                continue;
              }

              const { data: templateOptions } = await supabase
                .from("nutrition_meal_options")
                .select("*")
                .eq("meal_id", templateMeal.id)
                .order("option_order", { ascending: true });

              const optionIdMap = new Map<string, string>();

              if (templateOptions && templateOptions.length > 0) {
                for (const templateOption of templateOptions) {
                  const { data: newOption, error: optInsError } = await supabase
                    .from("nutrition_meal_options")
                    .insert({
                      meal_id: newMeal.id,
                      name: templateOption.name,
                      option_order: templateOption.option_order,
                      protein: templateOption.protein,
                      carbs: templateOption.carbs,
                      fats: templateOption.fats,
                      calories: templateOption.calories,
                      image_url: templateOption.image_url ?? null,
                    })
                    .select("id")
                    .single();

                  if (optInsError || !newOption) {
                    console.error(
                      "[Nutrition Plans API] Error cloning meal option:",
                      optInsError
                    );
                    continue;
                  }

                  optionIdMap.set(templateOption.id, newOption.id);
                }
              } else {
                const { data: fallbackOption, error: fbError } = await supabase
                  .from("nutrition_meal_options")
                  .insert({
                    meal_id: newMeal.id,
                    name: "Opción 1",
                    option_order: 1,
                    protein: newMeal.protein ?? null,
                    carbs: newMeal.carbs ?? null,
                    fats: newMeal.fats ?? null,
                    calories: newMeal.calories ?? null,
                    image_url: newMeal.image_url ?? null,
                  })
                  .select("id")
                  .single();

                if (fbError || !fallbackOption) {
                  console.error(
                    "[Nutrition Plans API] Error creating fallback meal option:",
                    fbError
                  );
                  continue;
                }
              }

              const { data: templateIngredients } = await supabase
                .from("nutrition_ingredients")
                .select("*")
                .eq("nutrition_meal_id", templateMeal.id)
                .order("ingredient_order", { ascending: true });

              if (templateIngredients && templateIngredients.length > 0) {
                const { data: firstNewOption } = await supabase
                  .from("nutrition_meal_options")
                  .select("id")
                  .eq("meal_id", newMeal.id)
                  .order("option_order", { ascending: true })
                  .limit(1)
                  .maybeSingle();

                const defaultNewOptionId = firstNewOption?.id;

                if (!defaultNewOptionId) {
                  console.error(
                    "[Nutrition Plans API] No target option for cloned ingredients"
                  );
                  continue;
                }

                const ingredientsToInsert = templateIngredients.map((ing) => {
                  const newOptId =
                    ing.option_id && optionIdMap.has(ing.option_id)
                      ? optionIdMap.get(ing.option_id)!
                      : defaultNewOptionId;

                  return {
                    tenant_host: tenant.host,
                    nutrition_meal_id: newMeal.id,
                    option_id: newOptId,
                    name: ing.name,
                    quantity: ing.quantity,
                    unit: ing.unit,
                    ingredient_order: ing.ingredient_order,
                    protein: ing.protein,
                    carbs: ing.carbs,
                    fats: ing.fats,
                    calories: ing.calories,
                  };
                });

                const { error: ingInsertError } = await supabase
                  .from("nutrition_ingredients")
                  .insert(ingredientsToInsert);

                if (ingInsertError) {
                  console.error(
                    "[Nutrition Plans API] Error cloning ingredients:",
                    ingInsertError
                  );
                }
              }
            }
          }
        }
      }
    } else {
      // Create a blank nutrition plan
      const { data: newPlan, error: planError } = await supabase
        .from("nutrition_plans")
        .insert({
          tenant_host: tenant.host,
          client_id: is_template ? null : client_id, // Templates don't have client_id
          trainer_id: session.trainer_id,
          name,
          start_date: start_date || new Date().toISOString().split("T")[0],
          status: is_template ? "active" : status || "active",
          notes,
          is_template: is_template || false,
        })
        .select()
        .single();

      if (planError) {
        console.error("[Nutrition Plans API] Error creating plan:", planError);

        return NextResponse.json(
          { success: false, error: "Error al crear plan nutricional" },
          { status: 500 }
        );
      }

      plan = newPlan;
    }

    return NextResponse.json({
      success: true,
      data: { ...plan, days: [] },
    });
  } catch (error) {
    console.error("[Nutrition Plans API] Unexpected error:", error);

    return NextResponse.json(
      { success: false, error: "Error inesperado" },
      { status: 500 }
    );
  }
}
