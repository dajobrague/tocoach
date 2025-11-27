import { NextRequest, NextResponse } from "next/server";

import { getClientSession } from "@/lib/auth/client-session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";

// GET - Fetch supplement assignments for the authenticated client
export async function GET(request: NextRequest) {
  const supabase = createSupabaseClient();

  try {
    // Authenticate client
    const session = await getClientSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 401 }
      );
    }

    const clientId = session.client_id;

    console.log(
      "[Client Supplements API] Fetching assignments for client:",
      clientId
    );

    // Fetch assignments with supplement inventory data (left join)
    const { data: assignments, error: assignmentsError } = await supabase
      .from("client_supplement_assignments")
      .select(
        `
                *,
                supplement:supplement_inventory(*)
            `
      )
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });

    if (assignmentsError) {
      console.error(
        "[Client Supplements API] Error fetching assignments:",
        assignmentsError
      );

      return NextResponse.json(
        { success: false, error: "Error al obtener asignaciones" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: assignments || [],
    });
  } catch (error) {
    console.error("[Client Supplements API] Unexpected error:", error);

    return NextResponse.json(
      { success: false, error: "Error inesperado" },
      { status: 500 }
    );
  }
}
