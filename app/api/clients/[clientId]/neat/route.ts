import { NextRequest, NextResponse } from "next/server";

import { getTrainerSession } from "@/lib/auth/session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";

// GET - Fetch all NEAT cards for a client
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

    console.log("[NEAT API] Fetching NEAT cards for client:", clientId);

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

    // Fetch NEAT cards for the client
    const { data: cards, error } = await supabase
      .from("client_neat_cards")
      .select("*")
      .eq("client_id", clientId)
      .eq("tenant_host", tenant.host)
      .order("card_order", { ascending: true });

    if (error) {
      console.error("[NEAT API] Error fetching NEAT cards:", error);

      return NextResponse.json(
        { success: false, error: "Error al obtener tarjetas NEAT" },
        { status: 500 }
      );
    }

    console.log("[NEAT API] Found", cards?.length || 0, "NEAT cards");

    return NextResponse.json({
      success: true,
      data: cards || [],
    });
  } catch (error) {
    console.error("[NEAT API] Unexpected error:", error);

    return NextResponse.json(
      { success: false, error: "Error inesperado" },
      { status: 500 }
    );
  }
}

// POST - Create a new NEAT card
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

    console.log("[NEAT API] Creating NEAT card for client:", clientId);

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

    // Validate input
    if (!body.label || body.label.trim() === "") {
      return NextResponse.json(
        { success: false, error: "label es requerido" },
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

    // Get current max card_order for this client
    const { data: existingCards } = await supabase
      .from("client_neat_cards")
      .select("card_order")
      .eq("client_id", clientId)
      .eq("tenant_host", tenant.host)
      .order("card_order", { ascending: false })
      .limit(1);

    const nextOrder =
      existingCards && existingCards.length > 0
        ? existingCards[0].card_order + 1
        : 0;

    // Prepare data for insert
    const cardData = {
      client_id: parseInt(clientId),
      tenant_host: tenant.host,
      label: body.label.trim(),
      card_order: nextOrder,
      steps_goal: body.steps_goal !== undefined ? body.steps_goal : null,
      notes: body.notes || null,
      weekdays: body.weekdays || [],
    };

    // Insert the card
    const { data: card, error } = await supabase
      .from("client_neat_cards")
      .insert(cardData)
      .select()
      .single();

    if (error) {
      console.error("[NEAT API] Error creating NEAT card:", error);

      return NextResponse.json(
        { success: false, error: "Error al guardar tarjeta NEAT" },
        { status: 500 }
      );
    }

    console.log("[NEAT API] Successfully created NEAT card");

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
