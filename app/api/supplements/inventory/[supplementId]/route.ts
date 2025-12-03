import { NextRequest, NextResponse } from "next/server";

import { getTrainerSession } from "@/lib/auth/session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";

// GET - Fetch a specific supplement from inventory
export async function GET(
  request: NextRequest,
  { params }: { params: { supplementId: string } }
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

    const { supplementId } = params;

    console.log(
      "[Supplement Inventory API] Fetching supplement:",
      supplementId
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

    // Fetch the supplement
    const { data: supplement, error: supplementError } = await supabase
      .from("supplement_inventory")
      .select("*")
      .eq("id", supplementId)
      .eq("tenant_host", tenant.host)
      .eq("trainer_id", session.trainer_id)
      .single();

    if (supplementError || !supplement) {
      console.error(
        "[Supplement Inventory API] Error fetching supplement:",
        supplementError
      );

      return NextResponse.json(
        { success: false, error: "Suplemento no encontrado" },
        { status: 404 }
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

// PATCH - Update a supplement in inventory
export async function PATCH(
  request: NextRequest,
  { params }: { params: { supplementId: string } }
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

    const { supplementId } = params;
    const body = await request.json();
    const {
      name,
      description,
      quantity,
      unit,
      product_url,
      images,
      is_archived,
    } = body;

    console.log(
      "[Supplement Inventory API] Updating supplement:",
      supplementId,
      body
    );

    // Validate images array if provided (max 5)
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

    // Build update object
    const updateData: any = {};

    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (quantity !== undefined)
      updateData.quantity = quantity ? parseFloat(quantity) : null;
    if (unit !== undefined) updateData.unit = unit || null;
    if (product_url !== undefined) updateData.product_url = product_url || null;
    if (images !== undefined) updateData.images = images;
    if (is_archived !== undefined) updateData.is_archived = is_archived;

    // Update the supplement
    const { data: supplement, error: supplementError } = await supabase
      .from("supplement_inventory")
      .update(updateData)
      .eq("id", supplementId)
      .eq("tenant_host", tenant.host)
      .eq("trainer_id", session.trainer_id)
      .select()
      .single();

    if (supplementError || !supplement) {
      console.error(
        "[Supplement Inventory API] Error updating supplement:",
        supplementError
      );

      return NextResponse.json(
        { success: false, error: "Error al actualizar suplemento" },
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

// DELETE - Soft delete a supplement (archive it)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { supplementId: string } }
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

    const { supplementId } = params;

    console.log(
      "[Supplement Inventory API] Archiving supplement:",
      supplementId
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

    // Soft delete by setting is_archived to true
    const { data: supplement, error: supplementError } = await supabase
      .from("supplement_inventory")
      .update({ is_archived: true })
      .eq("id", supplementId)
      .eq("tenant_host", tenant.host)
      .eq("trainer_id", session.trainer_id)
      .select()
      .single();

    if (supplementError || !supplement) {
      console.error(
        "[Supplement Inventory API] Error archiving supplement:",
        supplementError
      );

      return NextResponse.json(
        { success: false, error: "Error al archivar suplemento" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: supplement,
      message: "Suplemento archivado correctamente",
    });
  } catch (error) {
    console.error("[Supplement Inventory API] Unexpected error:", error);

    return NextResponse.json(
      { success: false, error: "Error inesperado" },
      { status: 500 }
    );
  }
}
