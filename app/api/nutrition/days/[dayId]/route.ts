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

    // Single-query ownership check via `tenant_host`. Replaces the prior
    // day → plan → trainer chain (2 sequential round-trips). All
    // nutrition_days rows carry `tenant_host` (verified populated). The
    // UPDATE below re-applies the same filter.
    const { data: existingDay, error: checkError } = await supabase
      .from("nutrition_days")
      .select("id")
      .eq("id", dayId)
      .eq("tenant_host", session.tenant_host)
      .maybeSingle();

    if (checkError) {
      console.error("[Nutrition Days API] Ownership check failed:", checkError);

      return NextResponse.json(
        { success: false, error: "Error al verificar día" },
        { status: 500 }
      );
    }

    if (!existingDay) {
      return NextResponse.json(
        { success: false, error: "Día no encontrado o no autorizado" },
        { status: 404 }
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
      .eq("tenant_host", session.tenant_host)
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

    // Single-query ownership check via `tenant_host` — see PATCH above.
    const { data: existingDay, error: checkError } = await supabase
      .from("nutrition_days")
      .select("id")
      .eq("id", dayId)
      .eq("tenant_host", session.tenant_host)
      .maybeSingle();

    if (checkError) {
      console.error("[Nutrition Days API] Ownership check failed:", checkError);

      return NextResponse.json(
        { success: false, error: "Error al verificar día" },
        { status: 500 }
      );
    }

    if (!existingDay) {
      return NextResponse.json(
        { success: false, error: "Día no encontrado o no autorizado" },
        { status: 404 }
      );
    }

    // Delete the day (cascades to meals and ingredients)
    const { error: deleteError } = await supabase
      .from("nutrition_days")
      .delete()
      .eq("id", dayId)
      .eq("tenant_host", session.tenant_host);

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
