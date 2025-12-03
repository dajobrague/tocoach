import { NextRequest, NextResponse } from "next/server";

import { getTrainerSession } from "@/lib/auth/session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";

// GET - Fetch all NEAT goals for a client
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
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

    const { clientId } = await params;

    console.log("[NEAT API] Fetching NEAT goals for client:", clientId);

    // Fetch NEAT goals for the client
    const { data: goals, error } = await supabase
      .from("client_neat_goals")
      .select("*")
      .eq("client_id", clientId)
      .eq("tenant_host", session.tenant_host)
      .order("weekday", { ascending: true });

    if (error) {
      console.error("[NEAT API] Error fetching NEAT goals:", error);

      return NextResponse.json(
        { success: false, error: "Error al obtener objetivos NEAT" },
        { status: 500 }
      );
    }

    console.log("[NEAT API] Found", goals?.length || 0, "NEAT goals");

    return NextResponse.json({
      success: true,
      data: goals || [],
    });
  } catch (error) {
    console.error("[NEAT API] Unexpected error:", error);

    return NextResponse.json(
      { success: false, error: "Error inesperado" },
      { status: 500 }
    );
  }
}

// POST - Create or update NEAT goals for specific weekdays
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
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

    const { clientId } = await params;
    const body = await request.json();

    console.log(
      "[NEAT API] Creating/updating NEAT goals for client:",
      clientId
    );

    // Validate input
    if (!body.weekday && body.weekday !== 0) {
      return NextResponse.json(
        { success: false, error: "weekday es requerido" },
        { status: 400 }
      );
    }

    if (body.weekday < 0 || body.weekday > 6) {
      return NextResponse.json(
        { success: false, error: "weekday debe estar entre 0 y 6" },
        { status: 400 }
      );
    }

    if (body.day_type && !["active", "break"].includes(body.day_type)) {
      return NextResponse.json(
        { success: false, error: "day_type debe ser 'active' o 'break'" },
        { status: 400 }
      );
    }

    // Validate numeric goals (must be positive if provided)
    if (
      body.steps_goal !== null &&
      body.steps_goal !== undefined &&
      body.steps_goal < 0
    ) {
      return NextResponse.json(
        { success: false, error: "steps_goal debe ser positivo" },
        { status: 400 }
      );
    }

    if (
      body.active_minutes_goal !== null &&
      body.active_minutes_goal !== undefined &&
      body.active_minutes_goal < 0
    ) {
      return NextResponse.json(
        { success: false, error: "active_minutes_goal debe ser positivo" },
        { status: 400 }
      );
    }

    if (
      body.distance_goal_km !== null &&
      body.distance_goal_km !== undefined &&
      body.distance_goal_km < 0
    ) {
      return NextResponse.json(
        { success: false, error: "distance_goal_km debe ser positivo" },
        { status: 400 }
      );
    }

    // Prepare data for upsert
    const goalData = {
      client_id: parseInt(clientId),
      tenant_host: session.tenant_host,
      weekday: body.weekday,
      day_type: body.day_type || "active",
      steps_goal: body.steps_goal !== undefined ? body.steps_goal : null,
      active_minutes_goal:
        body.active_minutes_goal !== undefined
          ? body.active_minutes_goal
          : null,
      distance_goal_km:
        body.distance_goal_km !== undefined ? body.distance_goal_km : null,
      notes: body.notes || null,
    };

    // Use upsert to create or update
    const { data: goal, error } = await supabase
      .from("client_neat_goals")
      .upsert(goalData, {
        onConflict: "client_id,tenant_host,weekday",
      })
      .select()
      .single();

    if (error) {
      console.error("[NEAT API] Error creating/updating NEAT goal:", error);

      return NextResponse.json(
        { success: false, error: "Error al guardar objetivo NEAT" },
        { status: 500 }
      );
    }

    console.log("[NEAT API] Successfully created/updated NEAT goal");

    return NextResponse.json({
      success: true,
      data: goal,
    });
  } catch (error) {
    console.error("[NEAT API] Unexpected error:", error);

    return NextResponse.json(
      { success: false, error: "Error inesperado" },
      { status: 500 }
    );
  }
}
