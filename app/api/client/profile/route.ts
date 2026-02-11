import { NextRequest, NextResponse } from "next/server";

import { getClientSession } from "@/lib/auth/client-session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";

// GET - Fetch profile for the authenticated client
export async function GET(request: NextRequest) {
  const supabase = createSupabaseClient();

  try {
    const session = await getClientSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 401 }
      );
    }

    const { data: profile, error } = await supabase
      .from("clients")
      .select("*")
      .eq("id", session.client_id)
      .single();

    if (error) {
      console.error("[Client Profile API] Error:", error);

      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, profile });
  } catch (error) {
    console.error("[Client Profile API] Unexpected error:", error);

    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
