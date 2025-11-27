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
    const { data: updatedClient, error: updateError } = await supabase
      .from("clients")
      .update({
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
      })
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
