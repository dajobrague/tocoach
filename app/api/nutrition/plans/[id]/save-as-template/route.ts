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

    // Clone the plan tree level by level — one read + one bulk insert per
    // level (days, meals, options, ingredients) instead of one round trip
    // per row. PostgREST returns inserted rows in payload order, which is
    // what makes the old→new id mapping by index safe.
    const { data: sourceDays } = await supabase
      .from("nutrition_days")
      .select("*")
      .eq("nutrition_plan_id", planId)
      .order("day_order", { ascending: true });

    cloneTree: if (sourceDays && sourceDays.length > 0) {
      const sourceDayIds = sourceDays.map((d) => d.id);
      const { data: sourceMealsData } = await supabase
        .from("nutrition_meals")
        .select("*")
        .in("nutrition_day_id", sourceDayIds)
        .order("meal_order", { ascending: true });

      const sourceMeals = sourceMealsData || [];
      const sourceMealIds = sourceMeals.map((m) => m.id);

      let sourceOptions: any[] = [];
      let sourceIngredients: any[] = [];

      if (sourceMealIds.length > 0) {
        const [optionsResult, ingredientsResult] = await Promise.all([
          supabase
            .from("nutrition_meal_options")
            .select("*")
            .in("meal_id", sourceMealIds)
            .order("option_order", { ascending: true }),
          supabase
            .from("nutrition_ingredients")
            .select("*")
            .in("nutrition_meal_id", sourceMealIds)
            .order("ingredient_order", { ascending: true }),
        ]);

        sourceOptions = optionsResult.data || [];
        sourceIngredients = ingredientsResult.data || [];
      }

      // 1. Days (no macros, no weekdays - templates are structure only)
      const { data: newDays, error: dayError } = await supabase
        .from("nutrition_days")
        .insert(
          sourceDays.map((sourceDay) => ({
            tenant_host: tenant.host,
            nutrition_plan_id: template.id,
            day_label: sourceDay.day_label,
            day_order: sourceDay.day_order,
            protein: 0,
            carbs: 0,
            fats: 0,
            calories: 0,
            weekdays: [],
          }))
        )
        .select("id");

      if (dayError || !newDays) {
        console.error(
          "[Save Nutrition Template API] Error cloning days:",
          dayError
        );
        break cloneTree;
      }

      const newDayIdBySourceDayId = new Map<string, string>(
        sourceDays.map((sourceDay, index) => [sourceDay.id, newDays[index]?.id])
      );

      // 2. Meals (no macros)
      const mealsToClone = sourceMeals.filter((sourceMeal) =>
        newDayIdBySourceDayId.has(sourceMeal.nutrition_day_id)
      );

      if (mealsToClone.length === 0) break cloneTree;

      const { data: newMeals, error: mealError } = await supabase
        .from("nutrition_meals")
        .insert(
          mealsToClone.map((sourceMeal) => ({
            tenant_host: tenant.host,
            nutrition_day_id: newDayIdBySourceDayId.get(
              sourceMeal.nutrition_day_id
            ),
            label: sourceMeal.label,
            meal_order: sourceMeal.meal_order,
            notes: sourceMeal.notes,
            protein: 0,
            carbs: 0,
            fats: 0,
            calories: 0,
            image_url: sourceMeal.image_url ?? null,
            has_alternatives: sourceMeal.has_alternatives ?? false,
          }))
        )
        .select("id");

      if (mealError || !newMeals) {
        console.error(
          "[Save Nutrition Template API] Error cloning meals:",
          mealError
        );
        break cloneTree;
      }

      const newMealIdBySourceMealId = new Map<string, string>(
        mealsToClone.map((sourceMeal, index) => [
          sourceMeal.id,
          newMeals[index]?.id,
        ])
      );

      // 3. Options: clone the source options; meals WITHOUT options get the
      // same "Opción 1" fallback as before (macros 0 like the new meal row,
      // image from the source meal).
      const sourceOptionsByMeal = new Map<string, any[]>();

      for (const sourceOption of sourceOptions) {
        const list = sourceOptionsByMeal.get(sourceOption.meal_id) ?? [];

        list.push(sourceOption);
        sourceOptionsByMeal.set(sourceOption.meal_id, list);
      }

      const optionRows: any[] = [];
      const optionSourceIds: (string | null)[] = [];

      for (const sourceMeal of mealsToClone) {
        const newMealId = newMealIdBySourceMealId.get(sourceMeal.id);
        const mealOptions = sourceOptionsByMeal.get(sourceMeal.id) ?? [];

        if (mealOptions.length > 0) {
          for (const sourceOption of mealOptions) {
            optionRows.push({
              meal_id: newMealId,
              name: sourceOption.name,
              option_order: sourceOption.option_order,
              protein: sourceOption.protein,
              carbs: sourceOption.carbs,
              fats: sourceOption.fats,
              calories: sourceOption.calories,
              image_url: sourceOption.image_url ?? null,
            });
            optionSourceIds.push(sourceOption.id);
          }
        } else {
          optionRows.push({
            meal_id: newMealId,
            name: "Opción 1",
            option_order: 1,
            protein: 0,
            carbs: 0,
            fats: 0,
            calories: 0,
            image_url: sourceMeal.image_url ?? null,
          });
          optionSourceIds.push(null);
        }
      }

      const { data: newOptions, error: optErr } = await supabase
        .from("nutrition_meal_options")
        .insert(optionRows)
        .select("id, meal_id, option_order");

      if (optErr || !newOptions) {
        console.error(
          "[Save Nutrition Template API] Error cloning options:",
          optErr
        );
        break cloneTree;
      }

      const optionIdMap = new Map<string, string>();

      optionSourceIds.forEach((sourceOptionId, index) => {
        const newOptionId = newOptions[index]?.id;

        if (sourceOptionId && newOptionId) {
          optionIdMap.set(sourceOptionId, newOptionId);
        }
      });

      // Default option per NEW meal = its first option by option_order
      // (same rule as the old per-meal lookup).
      const defaultOptionByNewMealId = new Map<string, string>();

      for (const option of newOptions) {
        const current = defaultOptionByNewMealId.get(option.meal_id);
        const currentOrder = current
          ? newOptions.find((o) => o.id === current)?.option_order
          : undefined;

        if (currentOrder === undefined || option.option_order < currentOrder) {
          defaultOptionByNewMealId.set(option.meal_id, option.id);
        }
      }

      // 4. Ingredients, remapped to their cloned option (or the meal's
      // default option when the source row has no/unknown option_id).
      const ingredientsToInsert = sourceIngredients
        .map((ing) => {
          const newMealId = newMealIdBySourceMealId.get(ing.nutrition_meal_id);

          if (!newMealId) return null;

          const newOptId =
            ing.option_id && optionIdMap.has(ing.option_id)
              ? optionIdMap.get(ing.option_id)!
              : defaultOptionByNewMealId.get(newMealId);

          if (!newOptId) {
            console.error(
              "[Save Nutrition Template API] No option for ingredients"
            );

            return null;
          }

          return {
            tenant_host: tenant.host,
            nutrition_meal_id: newMealId,
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
        })
        .filter(Boolean);

      if (ingredientsToInsert.length > 0) {
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
