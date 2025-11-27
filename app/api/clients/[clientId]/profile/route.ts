import { NextRequest, NextResponse } from "next/server";

import { getTrainerSession } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/clients/supabase-server";

export async function GET(
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

    console.log("[Client Profile API] Fetching profile for client:", clientId);
    console.log("[Client Profile API] Trainer ID:", session.trainer_id);

    // Fetch client from the clients table
    // The 'tenant' column in clients table stores the trainer UUID
    const { data: client, error: clientError } = (await supabase
      .from("clients")
      .select("*")
      .eq("id", clientId)
      .eq("tenant", session.trainer_id)
      .single()) as { data: any; error: any };

    console.log("[Client Profile API] Client query result:", {
      found: !!client,
      error: clientError,
    });

    if (clientError || !client) {
      console.error("[Client Profile API] Error fetching client:", {
        error: clientError,
        clientId,
        trainerId: session.trainer_id,
      });

      return NextResponse.json(
        {
          error: "Client not found",
          details: clientError?.message,
          debugInfo: {
            clientId,
            trainerId: session.trainer_id,
            errorCode: clientError?.code,
          },
        },
        { status: 404 }
      );
    }

    // Calculate age from dob if available
    let age = null;

    if (client.dob) {
      const birthDate = new Date(client.dob);
      const today = new Date();

      age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();

      if (
        monthDiff < 0 ||
        (monthDiff === 0 && today.getDate() < birthDate.getDate())
      ) {
        age--;
      }
    }

    // Format location if available
    const location =
      client.city || client.state || client.country
        ? {
            city: client.city,
            state: client.state,
            country: client.country,
            zip: client.zip,
          }
        : null;

    // Return formatted client data
    return NextResponse.json({
      id: client.id,
      name: `${client.name} ${client.last_name || ""}`.trim(),
      firstName: client.name,
      lastName: client.last_name || "",
      nickName: client.nick_name,
      email: client.email,
      avatar: client.profile_picture_url,
      status: client.status,
      joinedDate: client.sign_up_date,
      age,
      occupation: client.occupation || "No especificado",
      goals: [], // TODO: Add goals from a separate table if needed
      phone: client.phone,
      dob: client.dob,
      nationalId: client.national_id,
      location,
    });
  } catch (error) {
    console.error("[Client Profile API] Error:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
