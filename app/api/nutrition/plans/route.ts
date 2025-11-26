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
    const { client_id, name, start_date, status, notes } = body;

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

    // Create the nutrition plan
    const { data: plan, error: planError } = await supabase
      .from("nutrition_plans")
      .insert({
        tenant_host: tenant.host,
        client_id,
        trainer_id: session.trainer_id,
        name,
        start_date: start_date || new Date().toISOString().split("T")[0],
        status: status || "active",
        notes,
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
