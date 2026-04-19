import { NextRequest, NextResponse } from "next/server";

import { getTrainerSession } from "@/lib/auth/session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";

async function verifyOptionAccess(
  supabase: ReturnType<typeof createSupabaseClient>,
  trainerId: string,
  optionId: string
): Promise<
  | { ok: true; option: { id: string; meal_id: string } }
  | { ok: false; status: number; error: string }
> {
  const { data: option, error: optError } = await supabase
    .from("nutrition_meal_options")
    .select("id, meal_id")
    .eq("id", optionId)
    .single();

  if (optError || !option) {
    return { ok: false, status: 404, error: "Opción no encontrada" };
  }

  const { data: meal, error: mealError } = await supabase
    .from("nutrition_meals")
    .select("nutrition_day_id")
    .eq("id", option.meal_id)
    .single();

  if (mealError || !meal) {
    return { ok: false, status: 404, error: "Comida no encontrada" };
  }

  const { data: day, error: dayError } = await supabase
    .from("nutrition_days")
    .select("nutrition_plan_id")
    .eq("id", meal.nutrition_day_id)
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

  return { ok: true, option };
}

// GET - Option with ingredients
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ optionId: string }> }
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

    const { optionId } = await params;
    const access = await verifyOptionAccess(
      supabase,
      session.trainer_id,
      optionId
    );

    if (!access.ok) {
      return NextResponse.json(
        { success: false, error: access.error },
        { status: access.status }
      );
    }

    const { data: optionRow, error: optFetchError } = await supabase
      .from("nutrition_meal_options")
      .select("*")
      .eq("id", optionId)
      .single();

    if (optFetchError || !optionRow) {
      return NextResponse.json(
        { success: false, error: "Opción no encontrada" },
        { status: 404 }
      );
    }

    const { data: ingredients, error: ingError } = await supabase
      .from("nutrition_ingredients")
      .select("*")
      .eq("option_id", optionId)
      .order("ingredient_order", { ascending: true });

    if (ingError) {
      console.error(
        "[Nutrition Options API] Error fetching ingredients:",
        ingError
      );

      return NextResponse.json(
        { success: false, error: "Error al obtener ingredientes" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { ...optionRow, ingredients: ingredients || [] },
    });
  } catch (error) {
    console.error("[Nutrition Options API] Unexpected error:", error);

    return NextResponse.json(
      { success: false, error: "Error inesperado" },
      { status: 500 }
    );
  }
}

// PATCH - Update option
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ optionId: string }> }
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

    const { optionId } = await params;
    const access = await verifyOptionAccess(
      supabase,
      session.trainer_id,
      optionId
    );

    if (!access.ok) {
      return NextResponse.json(
        { success: false, error: access.error },
        { status: access.status }
      );
    }

    const body = await request.json();
    const {
      name,
      option_order,
      protein,
      carbs,
      fats,
      calories,
      image_url,
      // Item 2.4: recipe fields. All optional.
      instructions,
      prep_time_minutes,
      cooking_time_minutes,
      servings,
      recipe_notes,
    } = body;

    const updateData: Record<string, unknown> = {};

    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim()) {
        return NextResponse.json(
          { success: false, error: "Nombre no válido" },
          { status: 400 }
        );
      }
      updateData.name = name.trim();
    }
    if (option_order !== undefined) updateData.option_order = option_order;
    if (protein !== undefined) updateData.protein = protein;
    if (carbs !== undefined) updateData.carbs = carbs;
    if (fats !== undefined) updateData.fats = fats;
    if (calories !== undefined) updateData.calories = calories;
    if (image_url !== undefined) updateData.image_url = image_url;

    // Item 2.4: recipe fields. Empty string from the UI is normalised to NULL
    // so the DB stays tidy (and so "clear" actually clears).
    const toNullableString = (v: unknown): string | null => {
      if (typeof v !== "string") return null;
      const trimmed = v.trim();

      return trimmed.length === 0 ? null : trimmed;
    };
    const toNullableNonNegInt = (v: unknown): number | null => {
      if (v === null || v === undefined || v === "") return null;
      const n = typeof v === "number" ? v : parseInt(String(v), 10);

      return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
    };
    const toNullablePositiveInt = (v: unknown): number | null => {
      if (v === null || v === undefined || v === "") return null;
      const n = typeof v === "number" ? v : parseInt(String(v), 10);

      return Number.isFinite(n) && n >= 1 ? Math.floor(n) : null;
    };

    if (instructions !== undefined)
      updateData.instructions = toNullableString(instructions);
    if (prep_time_minutes !== undefined)
      updateData.prep_time_minutes = toNullableNonNegInt(prep_time_minutes);
    if (cooking_time_minutes !== undefined)
      updateData.cooking_time_minutes =
        toNullableNonNegInt(cooking_time_minutes);
    if (servings !== undefined)
      updateData.servings = toNullablePositiveInt(servings);
    if (recipe_notes !== undefined)
      updateData.recipe_notes = toNullableString(recipe_notes);

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, error: "No hay campos para actualizar" },
        { status: 400 }
      );
    }

    const { data: option, error: updateError } = await supabase
      .from("nutrition_meal_options")
      .update(updateData)
      .eq("id", optionId)
      .select()
      .single();

    if (updateError) {
      console.error(
        "[Nutrition Options API] Error updating option:",
        updateError
      );

      return NextResponse.json(
        { success: false, error: "Error al actualizar opción" },
        { status: 500 }
      );
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

// DELETE - Remove option (ensure at least one option remains on the meal)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ optionId: string }> }
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

    const { optionId } = await params;
    const access = await verifyOptionAccess(
      supabase,
      session.trainer_id,
      optionId
    );

    if (!access.ok) {
      return NextResponse.json(
        { success: false, error: access.error },
        { status: access.status }
      );
    }

    const mealId = access.option.meal_id;

    const { error: deleteError } = await supabase
      .from("nutrition_meal_options")
      .delete()
      .eq("id", optionId);

    if (deleteError) {
      console.error(
        "[Nutrition Options API] Error deleting option:",
        deleteError
      );

      return NextResponse.json(
        { success: false, error: "Error al eliminar opción" },
        { status: 500 }
      );
    }

    const { count, error: countError } = await supabase
      .from("nutrition_meal_options")
      .select("*", { count: "exact", head: true })
      .eq("meal_id", mealId);

    if (countError) {
      console.error(
        "[Nutrition Options API] Error counting options:",
        countError
      );
    }

    let remaining = count ?? 0;

    if (remaining === 0) {
      const { data: meal, error: mealFetchError } = await supabase
        .from("nutrition_meals")
        .select("protein, carbs, fats, calories, image_url")
        .eq("id", mealId)
        .single();

      if (mealFetchError || !meal) {
        return NextResponse.json(
          { success: false, error: "Error al restaurar opción por defecto" },
          { status: 500 }
        );
      }

      const { error: insertDefaultError } = await supabase
        .from("nutrition_meal_options")
        .insert({
          meal_id: mealId,
          name: "Opción 1",
          option_order: 1,
          protein: meal.protein ?? null,
          carbs: meal.carbs ?? null,
          fats: meal.fats ?? null,
          calories: meal.calories ?? null,
          image_url: meal.image_url ?? null,
        });

      if (insertDefaultError) {
        console.error(
          "[Nutrition Options API] Error inserting default option:",
          insertDefaultError
        );

        return NextResponse.json(
          { success: false, error: "Error al crear opción por defecto" },
          { status: 500 }
        );
      }

      remaining = 1;
    }

    await supabase
      .from("nutrition_meals")
      .update({ has_alternatives: remaining > 1 })
      .eq("id", mealId);

    return NextResponse.json({
      success: true,
      message: "Opción eliminada exitosamente",
    });
  } catch (error) {
    console.error("[Nutrition Options API] Unexpected error:", error);

    return NextResponse.json(
      { success: false, error: "Error inesperado" },
      { status: 500 }
    );
  }
}
