import { NextRequest, NextResponse } from "next/server";

import { getTrainerSession } from "@/lib/auth/session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";

// POST - Save an existing nutrition plan as a template
export async function POST(
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
    const { templateName } = body;

    console.log(
      "[Save Nutrition Template API] Saving plan as template:",
      planId,
      templateName
    );

    // Fetch the source plan
    const { data: sourcePlan, error: planError } = await supabase
      .from("nutrition_plans")
      .select("*")
      .eq("id", planId)
      .eq("trainer_id", session.trainer_id)
      .eq("is_template", false)
      .single();

    if (planError || !sourcePlan) {
      console.error("[Save Nutrition Template API] Plan not found:", planError);

      return NextResponse.json(
        { success: false, error: "Plan nutricional no encontrado" },
        { status: 404 }
      );
    }

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

    // Create the template (no client_id, no start_date, no status, no macros, no weekdays)
    const { data: template, error: templateError } = await supabase
      .from("nutrition_plans")
      .insert({
        tenant_host: tenant.host,
        trainer_id: session.trainer_id,
        name: templateName,
        notes: sourcePlan.notes,
        is_template: true,
        client_id: null,
        start_date: new Date().toISOString().split("T")[0], // Default date
        status: "active", // Default status for templates
        show_meal_images:
          sourcePlan.show_meal_images !== undefined
            ? Boolean(sourcePlan.show_meal_images)
            : true,
      })
      .select()
      .single();

    if (templateError || !template) {
      console.error(
        "[Save Nutrition Template API] Error creating template:",
        templateError
      );

      return NextResponse.json(
        { success: false, error: "Error al crear plantilla" },
        { status: 500 }
      );
    }

    // Clone days from the source plan
    const { data: sourceDays } = await supabase
      .from("nutrition_days")
      .select("*")
      .eq("nutrition_plan_id", planId)
      .order("day_order", { ascending: true });

    if (sourceDays && sourceDays.length > 0) {
      for (const sourceDay of sourceDays) {
        // Create new day (no macros, no weekdays - templates are structure only)
        const { data: newDay, error: dayError } = await supabase
          .from("nutrition_days")
          .insert({
            tenant_host: tenant.host,
            nutrition_plan_id: template.id,
            day_label: sourceDay.day_label,
            day_order: sourceDay.day_order,
            protein: 0,
            carbs: 0,
            fats: 0,
            calories: 0,
            weekdays: [],
          })
          .select()
          .single();

        if (dayError || !newDay) {
          console.error(
            "[Save Nutrition Template API] Error cloning day:",
            dayError
          );
          continue;
        }

        // Clone meals for this day
        const { data: sourceMeals } = await supabase
          .from("nutrition_meals")
          .select("*")
          .eq("nutrition_day_id", sourceDay.id)
          .order("meal_order", { ascending: true });

        if (sourceMeals && sourceMeals.length > 0) {
          for (const sourceMeal of sourceMeals) {
            // Create new meal (no macros)
            const { data: newMeal, error: mealError } = await supabase
              .from("nutrition_meals")
              .insert({
                tenant_host: tenant.host,
                nutrition_day_id: newDay.id,
                label: sourceMeal.label,
                meal_order: sourceMeal.meal_order,
                notes: sourceMeal.notes,
                protein: 0,
                carbs: 0,
                fats: 0,
                calories: 0,
                image_url: sourceMeal.image_url ?? null,
                has_alternatives: sourceMeal.has_alternatives ?? false,
              })
              .select()
              .single();

            if (mealError || !newMeal) {
              console.error(
                "[Save Nutrition Template API] Error cloning meal:",
                mealError
              );
              continue;
            }

            const { data: sourceOptions } = await supabase
              .from("nutrition_meal_options")
              .select("*")
              .eq("meal_id", sourceMeal.id)
              .order("option_order", { ascending: true });

            const optionIdMap = new Map<string, string>();

            if (sourceOptions && sourceOptions.length > 0) {
              for (const sourceOption of sourceOptions) {
                const { data: newOption, error: optErr } = await supabase
                  .from("nutrition_meal_options")
                  .insert({
                    meal_id: newMeal.id,
                    name: sourceOption.name,
                    option_order: sourceOption.option_order,
                    protein: sourceOption.protein,
                    carbs: sourceOption.carbs,
                    fats: sourceOption.fats,
                    calories: sourceOption.calories,
                    image_url: sourceOption.image_url ?? null,
                  })
                  .select("id")
                  .single();

                if (optErr || !newOption) {
                  console.error(
                    "[Save Nutrition Template API] Error cloning option:",
                    optErr
                  );
                  continue;
                }

                optionIdMap.set(sourceOption.id, newOption.id);
              }
            } else {
              const { data: fallbackOption, error: fbErr } = await supabase
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

              if (fbErr || !fallbackOption) {
                console.error(
                  "[Save Nutrition Template API] Error creating default option:",
                  fbErr
                );
                continue;
              }
            }

            const { data: sourceIngredients } = await supabase
              .from("nutrition_ingredients")
              .select("*")
              .eq("nutrition_meal_id", sourceMeal.id)
              .order("ingredient_order", { ascending: true });

            if (sourceIngredients && sourceIngredients.length > 0) {
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
                  "[Save Nutrition Template API] No option for ingredients"
                );
                continue;
              }

              const ingredientsToInsert = sourceIngredients.map((ing) => {
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

              const { error: ingErr } = await supabase
                .from("nutrition_ingredients")
                .insert(ingredientsToInsert);

              if (ingErr) {
                console.error(
                  "[Save Nutrition Template API] Error cloning ingredients:",
                  ingErr
                );
              }
            }
          }
        }
      }
    }

    console.log(
      "[Save Nutrition Template API] Template created successfully:",
      template.id
    );

    return NextResponse.json({
      success: true,
      templateId: template.id,
      message: "Plantilla creada exitosamente",
    });
  } catch (error) {
    console.error("[Save Nutrition Template API] Unexpected error:", error);

    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
