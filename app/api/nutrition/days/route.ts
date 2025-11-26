import { NextRequest, NextResponse } from "next/server";

import { getTrainerSession } from "@/lib/auth/session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";

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
    const { nutrition_plan_id, day_label, day_order } = body;

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

    // Create the nutrition day
    const { data: day, error: dayError } = await supabase
      .from("nutrition_days")
      .insert({
        nutrition_plan_id,
        tenant_host: plan.tenant_host,
        day_label,
        day_order: orderToUse,
      })
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
