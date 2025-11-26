import { NextRequest, NextResponse } from "next/server";

import { getTrainerSession } from "@/lib/auth/session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";

// GET - Fetch all inventory items for a trainer
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const includeArchived = searchParams.get("include_archived") === "true";

    console.log(
      "[Supplement Inventory API] Fetching inventory for trainer:",
      session.trainer_id
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

    // Build query
    let query = supabase
      .from("supplement_inventory")
      .select("*")
      .eq("tenant_host", tenant.host)
      .eq("trainer_id", session.trainer_id)
      .order("created_at", { ascending: false });

    // Filter by archived status
    if (!includeArchived) {
      query = query.eq("is_archived", false);
    }

    const { data: inventory, error: inventoryError } = await query;

    if (inventoryError) {
      console.error(
        "[Supplement Inventory API] Error fetching inventory:",
        inventoryError
      );

      return NextResponse.json(
        { success: false, error: "Error al obtener inventario" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: inventory || [],
    });
  } catch (error) {
    console.error("[Supplement Inventory API] Unexpected error:", error);

    return NextResponse.json(
      { success: false, error: "Error inesperado" },
      { status: 500 }
    );
  }
}

// POST - Create a new supplement in inventory
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { name, description, quantity, unit, images } = body;

    console.log("[Supplement Inventory API] Creating supplement:", body);

    // Validate required fields
    if (!name || !unit || quantity === undefined) {
      return NextResponse.json(
        { success: false, error: "Campos requeridos: name, unit, quantity" },
        { status: 400 }
      );
    }

    // Validate images array (max 5)
    if (images && Array.isArray(images) && images.length > 5) {
      return NextResponse.json(
        { success: false, error: "Máximo 5 imágenes por producto" },
        { status: 400 }
      );
    }

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

    // Create the supplement
    const { data: supplement, error: supplementError } = await supabase
      .from("supplement_inventory")
      .insert({
        tenant_host: tenant.host,
        trainer_id: session.trainer_id,
        name,
        description: description || null,
        quantity: parseFloat(quantity),
        unit,
        images: images || [],
        is_archived: false,
      })
      .select()
      .single();

    if (supplementError) {
      console.error(
        "[Supplement Inventory API] Error creating supplement:",
        supplementError
      );

      return NextResponse.json(
        { success: false, error: "Error al crear suplemento" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: supplement,
    });
  } catch (error) {
    console.error("[Supplement Inventory API] Unexpected error:", error);

    return NextResponse.json(
      { success: false, error: "Error inesperado" },
      { status: 500 }
    );
  }
}
