import { NextRequest, NextResponse } from "next/server";

import { getTrainerSession } from "@/lib/auth/session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";

/**
 * PUT /api/forms/responses/[clientId]/[responseId]
 * Update an existing form response
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string; responseId: string }> }
) {
  const supabase = createSupabaseClient();

  try {
    const session = await getTrainerSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 401 }
      );
    }

    const { clientId: clientIdStr, responseId } = await params;
    const clientId = parseInt(clientIdStr);

    if (isNaN(clientId)) {
      return NextResponse.json(
        { success: false, error: "ID de cliente inválido" },
        { status: 400 }
      );
    }

    // Get tenant_host for this client
    const { data: tenantHost, error: tenantError } = await supabase
      .rpc("get_tenant_host_for_client", { p_client_id: clientId })
      .single();

    if (tenantError || !tenantHost) {
      return NextResponse.json(
        { success: false, error: "Cliente o tenant no encontrado" },
        { status: 404 }
      );
    }

    // Verify this tenant belongs to the logged-in trainer
    const { data: tenant } = await supabase
      .from("tenants")
      .select("host, trainer_id")
      .eq("host", tenantHost)
      .single();

    if (!tenant || tenant.trainer_id !== session.trainer_id) {
      return NextResponse.json(
        { success: false, error: "No autorizado para este cliente" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { answers, metadata } = body;

    if (!answers) {
      return NextResponse.json(
        { success: false, error: "Respuestas requeridas" },
        { status: 400 }
      );
    }

    // Update response
    const { data: response, error } = await supabase
      .from("form_responses")
      .update({
        answers,
        metadata: metadata || {},
      })
      .eq("id", responseId)
      .eq("client_id", clientId)
      .eq("tenant_host", tenantHost)
      .select()
      .single();

    if (error) {
      console.error("[Forms Responses] Error updating response:", error);

      return NextResponse.json(
        { success: false, error: "Error al actualizar respuesta" },
        { status: 500 }
      );
    }

    if (!response) {
      return NextResponse.json(
        { success: false, error: "Respuesta no encontrada" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      response,
    });
  } catch (error) {
    console.error("[Forms Responses] Unexpected error:", error);

    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/forms/responses/[clientId]/[responseId]
 * Delete a form response
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string; responseId: string }> }
) {
  const supabase = createSupabaseClient();

  try {
    const session = await getTrainerSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 401 }
      );
    }

    const { clientId: clientIdStr, responseId } = await params;
    const clientId = parseInt(clientIdStr);

    if (isNaN(clientId)) {
      return NextResponse.json(
        { success: false, error: "ID de cliente inválido" },
        { status: 400 }
      );
    }

    // Get tenant_host for this client
    const { data: tenantHost, error: tenantError } = await supabase
      .rpc("get_tenant_host_for_client", { p_client_id: clientId })
      .single();

    if (tenantError || !tenantHost) {
      return NextResponse.json(
        { success: false, error: "Cliente o tenant no encontrado" },
        { status: 404 }
      );
    }

    // Verify this tenant belongs to the logged-in trainer
    const { data: tenant } = await supabase
      .from("tenants")
      .select("host, trainer_id")
      .eq("host", tenantHost)
      .single();

    if (!tenant || tenant.trainer_id !== session.trainer_id) {
      return NextResponse.json(
        { success: false, error: "No autorizado para este cliente" },
        { status: 403 }
      );
    }

    // Delete response
    const { error } = await supabase
      .from("form_responses")
      .delete()
      .eq("id", responseId)
      .eq("client_id", clientId)
      .eq("tenant_host", tenantHost);

    if (error) {
      console.error("[Forms Responses] Error deleting response:", error);

      return NextResponse.json(
        { success: false, error: "Error al eliminar respuesta" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Respuesta eliminada exitosamente",
    });
  } catch (error) {
    console.error("[Forms Responses] Unexpected error:", error);

    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
