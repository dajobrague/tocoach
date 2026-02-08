/* eslint-disable no-console */
import { NextRequest, NextResponse } from "next/server";

import { getTrainerSession } from "@/lib/auth/session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";

// Helper function to auto-detect weekdays from Spanish day names
function detectWeekdaysFromLabel(label: string): number[] {
  const lowerLabel = label.toLowerCase();
  const weekdayMap: { [key: string]: number } = {
    domingo: 0,
    lunes: 1,
    martes: 2,
    miércoles: 3,
    miercoles: 3,
    jueves: 4,
    viernes: 5,
    sábado: 6,
    sabado: 6,
  };

  for (const [name, day] of Object.entries(weekdayMap)) {
    if (lowerLabel.includes(name)) {
      return [day];
    }
  }

  return [];
}

// PATCH - Reorder nutrition days
export async function PATCH(request: NextRequest) {
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
    const { reorder } = body;

    if (!reorder || !Array.isArray(reorder)) {
      return NextResponse.json(
        { success: false, error: "Se requiere un array de reorder" },
        { status: 400 }
      );
    }

    // Batch update day_order for each day
    const updatePromises = reorder.map(
      (item: { id: string; day_order: number }) =>
        supabase
          .from("nutrition_days")
          .update({ day_order: item.day_order })
          .eq("id", item.id)
    );

    const results = await Promise.all(updatePromises);
    const hasError = results.some((r) => r.error);

    if (hasError) {
      console.error(
        "[Nutrition Days API] Error reordering days:",
        results.filter((r) => r.error).map((r) => r.error)
      );

      return NextResponse.json(
        { success: false, error: "Error al reordenar días" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Días reordenados exitosamente",
    });
  } catch (error) {
    console.error("[Nutrition Days API] Unexpected error:", error);

    return NextResponse.json(
      { success: false, error: "Error inesperado" },
      { status: 500 }
    );
  }
}

// POST - Create a new nutrition day
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
      nutrition_plan_id,
      day_label,
      day_order,
      protein,
      carbs,
      fats,
      calories,
      weekdays,
    } = body;

    console.log("[Nutrition Days API] Creating day:", body);

    // Verify the plan belongs to this trainer and get tenant_host
    const { data: plan, error: planError } = await supabase
      .from("nutrition_plans")
      .select("id, tenant_host")
      .eq("id", nutrition_plan_id)
      .eq("trainer_id", session.trainer_id)
      .single();

    if (planError || !plan) {
      console.error(
        "[Nutrition Days API] Plan not found or unauthorized:",
        planError
      );

      return NextResponse.json(
        { success: false, error: "Plan no encontrado o no autorizado" },
        { status: 404 }
      );
    }

    // Get the current max day_order for this plan if not provided
    let orderToUse = day_order;

    if (orderToUse === undefined) {
      const { data: existingDays } = await supabase
        .from("nutrition_days")
        .select("day_order")
        .eq("nutrition_plan_id", nutrition_plan_id)
        .order("day_order", { ascending: false })
        .limit(1);

      orderToUse =
        existingDays && existingDays.length > 0 && existingDays[0]
          ? existingDays[0].day_order + 1
          : 0;
    }

    // Auto-detect weekdays from day label (Spanish weekday names)
    const autoDetectedWeekdays = detectWeekdaysFromLabel(day_label);
    const weekdaysToUse =
      weekdays !== undefined ? weekdays : autoDetectedWeekdays;

    // Create the nutrition day
    const insertData: any = {
      nutrition_plan_id,
      tenant_host: plan.tenant_host,
      day_label,
      day_order: orderToUse,
      weekdays: weekdaysToUse,
    };

    // Add macro fields if provided
    if (protein !== undefined) insertData.protein = protein;
    if (carbs !== undefined) insertData.carbs = carbs;
    if (fats !== undefined) insertData.fats = fats;
    if (calories !== undefined) insertData.calories = calories;

    const { data: day, error: dayError } = await supabase
      .from("nutrition_days")
      .insert(insertData)
      .select()
      .single();

    if (dayError) {
      console.error("[Nutrition Days API] Error creating day:", dayError);

      return NextResponse.json(
        { success: false, error: "Error al crear día" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { ...day, meals: [] },
    });
  } catch (error) {
    console.error("[Nutrition Days API] Unexpected error:", error);

    return NextResponse.json(
      { success: false, error: "Error inesperado" },
      { status: 500 }
    );
  }
}
