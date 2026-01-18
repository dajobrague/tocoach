import { NextRequest, NextResponse } from "next/server";

import { getTrainerSession } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/clients/supabase-server";

// PUT - Update client information
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    // Get trainer session
    const session = await getTrainerSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { clientId } = await params;
    const body = await request.json();
    const supabase = createServerSupabaseClient();

    console.log("[Update Client API] Updating client:", clientId);

    // Verify client belongs to trainer
    const { data: existingClient } = await supabase
      .from("clients")
      .select("*")
      .eq("id", clientId)
      .eq("tenant", session.trainer_id)
      .single();

    if (!existingClient) {
      return NextResponse.json(
        { error: "Client not found or access denied" },
        { status: 404 }
      );
    }

    // Update client data
    const updateData = {
      name: body.firstName,
      last_name: body.lastName,
      nick_name: body.nickName || null,
      email: body.email,
      phone: body.phone || null,
      occupation: body.occupation || null,
      dob: body.dob || null,
      city: body.city || null,
      state: body.state || null,
      country: body.country || null,
      zip: body.zip || null,
      national_id: body.nationalId || null,
      status: body.status || "Activo",
    };

    const { data: updatedClient, error: updateError } = await (
      supabase.from("clients") as any
    )
      .update(updateData)
      .eq("id", clientId)
      .select()
      .single();

    if (updateError) {
      console.error("[Update Client API] Error updating client:", updateError);

      return NextResponse.json(
        { error: "Failed to update client" },
        { status: 500 }
      );
    }

    console.log("[Update Client API] Client updated successfully");

    return NextResponse.json({
      success: true,
      client: updatedClient,
    });
  } catch (error) {
    console.error("[Update Client API] Error:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE - Delete client and all related data
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    // Get trainer session
    const session = await getTrainerSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { clientId } = await params;
    const supabase = createServerSupabaseClient();

    console.log("[Delete Client API] Starting deletion for client:", clientId);

    // Verify client belongs to trainer
    const { data: existingClient } = await supabase
      .from("clients")
      .select("*")
      .eq("id", clientId)
      .eq("tenant", session.trainer_id)
      .single();

    if (!existingClient) {
      return NextResponse.json(
        { error: "Client not found or access denied" },
        { status: 404 }
      );
    }

    console.log(
      "[Delete Client API] Client verified, proceeding with deletion"
    );

    // The following tables have ON DELETE CASCADE set up in the database:
    // - client_form_configs
    // - form_responses
    // - client_supplement_assignments
    // - nutrition_plans (cascades to nutrition_days, nutrition_meals, nutrition_ingredients)
    // - client_neat_cards
    // - client_programs
    // - scheduled_sessions
    // - exercise_logs
    // - client_measurements
    // - messages
    // - notifications
    // - client_tracking tables (body_weight_logs, body_measurements, photos, check_ins, etc.)

    // Delete the client - this will cascade to all related tables
    const { error: deleteError } = await supabase
      .from("clients")
      .delete()
      .eq("id", clientId);

    if (deleteError) {
      console.error("[Delete Client API] Error deleting client:", deleteError);

      return NextResponse.json(
        { error: "Failed to delete client" },
        { status: 500 }
      );
    }

    console.log(
      "[Delete Client API] Client and all related data deleted successfully"
    );
    console.log("[Delete Client API] Cascaded deletes handled by database:");
    console.log("  - Form configurations and responses");
    console.log("  - Supplement assignments");
    console.log("  - Nutrition plans and all related data");
    console.log("  - NEAT cards");
    console.log("  - Training programs and sessions");
    console.log("  - Exercise logs and measurements");
    console.log("  - Messages and notifications");

    return NextResponse.json({
      success: true,
      message: "Client and all related data deleted successfully",
    });
  } catch (error) {
    console.error("[Delete Client API] Error:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
