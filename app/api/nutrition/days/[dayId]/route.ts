import { NextRequest, NextResponse } from "next/server";

import { getTrainerSession } from "@/lib/auth/session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";

// PATCH - Update a nutrition day
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ dayId: string }> }
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

    const { dayId } = await params;
    const body = await request.json();
    const { day_label, day_order, protein, carbs, fats, calories, weekdays } =
      body;

    console.log("[Nutrition Days API] Updating day:", dayId, body);

    // Verify the day belongs to a plan owned by this trainer
    const { data: existingDay, error: checkError } = await supabase
      .from("nutrition_days")
      .select("id, nutrition_plan_id")
      .eq("id", dayId)
      .single();

    if (checkError || !existingDay) {
      console.error("[Nutrition Days API] Day not found:", checkError);

      return NextResponse.json(
        { success: false, error: "Día no encontrado" },
        { status: 404 }
      );
    }

    // Verify the plan belongs to this trainer
    const { data: plan, error: planError } = await supabase
      .from("nutrition_plans")
      .select("id")
      .eq("id", existingDay.nutrition_plan_id)
      .eq("trainer_id", session.trainer_id)
      .single();

    if (planError || !plan) {
      console.error(
        "[Nutrition Days API] Plan not found or unauthorized:",
        planError
      );

      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 403 }
      );
    }

    // Update the day
    const updateData: any = {};

    if (day_label !== undefined) updateData.day_label = day_label;
    if (day_order !== undefined) updateData.day_order = day_order;
    if (protein !== undefined) updateData.protein = protein;
    if (carbs !== undefined) updateData.carbs = carbs;
    if (fats !== undefined) updateData.fats = fats;
    if (calories !== undefined) updateData.calories = calories;
    if (weekdays !== undefined) updateData.weekdays = weekdays;

    const { data: day, error: updateError } = await supabase
      .from("nutrition_days")
      .update(updateData)
      .eq("id", dayId)
      .select()
      .single();

    if (updateError) {
      console.error("[Nutrition Days API] Error updating day:", updateError);

      return NextResponse.json(
        { success: false, error: "Error al actualizar día" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: day,
    });
  } catch (error) {
    console.error("[Nutrition Days API] Unexpected error:", error);

    return NextResponse.json(
      { success: false, error: "Error inesperado" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a nutrition day
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ dayId: string }> }
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

    const { dayId } = await params;

    console.log("[Nutrition Days API] Deleting day:", dayId);

    // Verify the day belongs to a plan owned by this trainer
    const { data: existingDay, error: checkError } = await supabase
      .from("nutrition_days")
      .select("id, nutrition_plan_id")
      .eq("id", dayId)
      .single();

    if (checkError || !existingDay) {
      console.error("[Nutrition Days API] Day not found:", checkError);

      return NextResponse.json(
        { success: false, error: "Día no encontrado" },
        { status: 404 }
      );
    }

    // Verify the plan belongs to this trainer
    const { data: plan, error: planError } = await supabase
      .from("nutrition_plans")
      .select("id")
      .eq("id", existingDay.nutrition_plan_id)
      .eq("trainer_id", session.trainer_id)
      .single();

    if (planError || !plan) {
      console.error(
        "[Nutrition Days API] Plan not found or unauthorized:",
        planError
      );

      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 403 }
      );
    }

    // Delete the day (cascades to meals and ingredients)
    const { error: deleteError } = await supabase
      .from("nutrition_days")
      .delete()
      .eq("id", dayId);

    if (deleteError) {
      console.error("[Nutrition Days API] Error deleting day:", deleteError);

      return NextResponse.json(
        { success: false, error: "Error al eliminar día" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Día eliminado exitosamente",
    });
  } catch (error) {
    console.error("[Nutrition Days API] Unexpected error:", error);

    return NextResponse.json(
      { success: false, error: "Error inesperado" },
      { status: 500 }
    );
  }
}
