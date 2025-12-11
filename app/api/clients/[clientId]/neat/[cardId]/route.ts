import { NextRequest, NextResponse } from "next/server";

import { getTrainerSession } from "@/lib/auth/session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";

// PUT - Update a specific NEAT card
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string; cardId: string }> }
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

    const { clientId, cardId } = await params;
    const body = await request.json();

    console.log(
      "[NEAT API] Updating NEAT card:",
      cardId,
      "for client:",
      clientId
    );

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

    // Validate label if provided
    if (body.label !== undefined && body.label.trim() === "") {
      return NextResponse.json(
        { success: false, error: "label no puede estar vacío" },
        { status: 400 }
      );
    }

    // Validate steps_goal (must be positive if provided)
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

    // Build update object (only include provided fields)
    const updateData: any = {};

    if (body.label !== undefined) updateData.label = body.label.trim();
    if (body.steps_goal !== undefined) updateData.steps_goal = body.steps_goal;
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.weekdays !== undefined) updateData.weekdays = body.weekdays;
    if (body.card_order !== undefined) updateData.card_order = body.card_order;

    // Update the card
    const { data: card, error } = await supabase
      .from("client_neat_cards")
      .update(updateData)
      .eq("id", cardId)
      .eq("client_id", clientId)
      .eq("tenant_host", tenant.host)
      .select()
      .single();

    if (error) {
      console.error("[NEAT API] Error updating NEAT card:", error);

      return NextResponse.json(
        { success: false, error: "Error al actualizar tarjeta NEAT" },
        { status: 500 }
      );
    }

    if (!card) {
      return NextResponse.json(
        { success: false, error: "Tarjeta NEAT no encontrada" },
        { status: 404 }
      );
    }

    console.log("[NEAT API] Successfully updated NEAT card");

    return NextResponse.json({
      success: true,
      data: card,
    });
  } catch (error) {
    console.error("[NEAT API] Unexpected error:", error);

    return NextResponse.json(
      { success: false, error: "Error inesperado" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a specific NEAT card
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string; cardId: string }> }
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

    const { clientId, cardId } = await params;

    console.log(
      "[NEAT API] Deleting NEAT card:",
      cardId,
      "for client:",
      clientId
    );

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

    // Delete the card
    const { error } = await supabase
      .from("client_neat_cards")
      .delete()
      .eq("id", cardId)
      .eq("client_id", clientId)
      .eq("tenant_host", tenant.host);

    if (error) {
      console.error("[NEAT API] Error deleting NEAT card:", error);

      return NextResponse.json(
        { success: false, error: "Error al eliminar tarjeta NEAT" },
        { status: 500 }
      );
    }

    console.log("[NEAT API] Successfully deleted NEAT card");

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
