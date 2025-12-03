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

            // Clone ingredients for this meal (full details)
            const { data: sourceIngredients } = await supabase
              .from("nutrition_ingredients")
              .select("*")
              .eq("nutrition_meal_id", sourceMeal.id)
              .order("ingredient_order", { ascending: true });

            if (sourceIngredients && sourceIngredients.length > 0) {
              const ingredientsToInsert = sourceIngredients.map((ing) => ({
                tenant_host: tenant.host,
                nutrition_meal_id: newMeal.id,
                name: ing.name,
                quantity: ing.quantity,
                unit: ing.unit,
                ingredient_order: ing.ingredient_order,
                protein: ing.protein,
                carbs: ing.carbs,
                fats: ing.fats,
                calories: ing.calories,
              }));

              await supabase
                .from("nutrition_ingredients")
                .insert(ingredientsToInsert);
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
