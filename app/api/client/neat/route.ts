import type { ClientNeatCard } from "@/types";

import { NextRequest, NextResponse } from "next/server";

import { getClientSession } from "@/lib/auth/client-session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";

// GET - Fetch all NEAT cards for the authenticated client
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

    console.log("[Client NEAT API] Fetching NEAT cards for client:", clientId);

    // Fetch NEAT cards for the client
    const { data: cards, error } = await supabase
      .from("client_neat_cards")
      .select("*")
      .eq("client_id", clientId)
      .order("card_order", { ascending: true });

    if (error) {
      console.error("[Client NEAT API] Error fetching NEAT cards:", error);

      return NextResponse.json(
        { success: false, error: "Error al obtener tarjetas NEAT" },
        { status: 500 }
      );
    }

    console.log("[Client NEAT API] Found", cards?.length || 0, "NEAT cards");

    return NextResponse.json({
      success: true,
      cards: (cards as ClientNeatCard[]) || [],
    });
  } catch (error) {
    console.error("[Client NEAT API] Unexpected error:", error);

    return NextResponse.json(
      { success: false, error: "Error inesperado" },
      { status: 500 }
    );
  }
}
