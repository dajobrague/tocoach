import { NextRequest, NextResponse } from "next/server";

import { getTrainerSession } from "@/lib/auth/session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";

// PATCH - Update a specific NEAT goal
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string; goalId: string }> }
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

    const { clientId, goalId } = await params;
    const body = await request.json();

    console.log(
      "[NEAT API] Updating NEAT goal:",
      goalId,
      "for client:",
      clientId
    );

    // Validate day_type if provided
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

    // Build update object (only include provided fields)
    const updateData: any = {};

    if (body.day_type !== undefined) updateData.day_type = body.day_type;
    if (body.steps_goal !== undefined) updateData.steps_goal = body.steps_goal;
    if (body.active_minutes_goal !== undefined)
      updateData.active_minutes_goal = body.active_minutes_goal;
    if (body.distance_goal_km !== undefined)
      updateData.distance_goal_km = body.distance_goal_km;
    if (body.notes !== undefined) updateData.notes = body.notes;

    // Update the goal
    const { data: goal, error } = await supabase
      .from("client_neat_goals")
      .update(updateData)
      .eq("id", goalId)
      .eq("client_id", clientId)
      .eq("tenant_host", session.tenant_host)
      .select()
      .single();

    if (error) {
      console.error("[NEAT API] Error updating NEAT goal:", error);

      return NextResponse.json(
        { success: false, error: "Error al actualizar objetivo NEAT" },
        { status: 500 }
      );
    }

    if (!goal) {
      return NextResponse.json(
        { success: false, error: "Objetivo NEAT no encontrado" },
        { status: 404 }
      );
    }

    console.log("[NEAT API] Successfully updated NEAT goal");

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

// DELETE - Delete a specific NEAT goal
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string; goalId: string }> }
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

    const { clientId, goalId } = await params;

    console.log(
      "[NEAT API] Deleting NEAT goal:",
      goalId,
      "for client:",
      clientId
    );

    // Delete the goal
    const { error } = await supabase
      .from("client_neat_goals")
      .delete()
      .eq("id", goalId)
      .eq("client_id", clientId)
      .eq("tenant_host", session.tenant_host);

    if (error) {
      console.error("[NEAT API] Error deleting NEAT goal:", error);

      return NextResponse.json(
        { success: false, error: "Error al eliminar objetivo NEAT" },
        { status: 500 }
      );
    }

    console.log("[NEAT API] Successfully deleted NEAT goal");

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("[NEAT API] Unexpected error:", error);

    return NextResponse.json(
      { success: false, error: "Error inesperado" },
      { status: 500 }
    );
  }
}
