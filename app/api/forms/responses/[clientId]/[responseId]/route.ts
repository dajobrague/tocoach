import { NextRequest, NextResponse } from "next/server";

import { getTrainerSession } from "@/lib/auth/session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";
import { normalizeFormAnswers } from "@/lib/forms/answers-normalize";

const MAX_PATCH_TEXT = 5000;

/**
 * Corrección del entrenador (JC, nov): un cliente escribe 7,4 en vez de 74 y
 * la gráfica y la media se distorsionan. Solo se pueden corregir respuestas
 * que ya existen en el registro, con un número o un texto.
 */
function parseAnswerPatch(
  raw: unknown
): Record<string, number | string> | null {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  const entries = Object.entries(raw as Record<string, unknown>);

  if (entries.length === 0) return null;
  const ok = entries.every(
    ([, v]) =>
      (typeof v === "number" && Number.isFinite(v)) ||
      (typeof v === "string" && v.length <= MAX_PATCH_TEXT)
  );

  return ok
    ? (Object.fromEntries(entries) as Record<string, number | string>)
    : null;
}

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
    const { data: clientData, error: clientError } = await supabase
      .from("clients")
      .select("tenant")
      .eq("id", clientId)
      .single();

    if (clientError || !clientData) {
      return NextResponse.json(
        { success: false, error: "Cliente no encontrado" },
        { status: 404 }
      );
    }

    const { data: tenantData, error: tenantError } = await supabase
      .from("tenants")
      .select("host, trainer_id")
      .eq("trainer_id", clientData.tenant)
      .single();

    if (tenantError || !tenantData) {
      return NextResponse.json(
        { success: false, error: "Tenant no encontrado" },
        { status: 404 }
      );
    }

    const tenantHost = tenantData.host;

    if (tenantData.trainer_id !== session.trainer_id) {
      return NextResponse.json(
        { success: false, error: "No autorizado para este cliente" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { answers, metadata, reviewed, answer_patch } = body;

    // `reviewed` alone toggles the check-in review state (locks/unlocks
    // client edits); `answer_patch` corrects individual answers; otherwise
    // this is a full answers update.
    if (
      !answers &&
      answer_patch === undefined &&
      typeof reviewed !== "boolean"
    ) {
      return NextResponse.json(
        { success: false, error: "Respuestas requeridas" },
        { status: 400 }
      );
    }

    let update: Record<string, unknown>;

    if (answer_patch !== undefined) {
      const patch = parseAnswerPatch(answer_patch);

      if (!patch) {
        return NextResponse.json(
          { success: false, error: "Corrección inválida" },
          { status: 400 }
        );
      }

      const { data: existing } = await supabase
        .from("form_responses")
        .select("answers, metadata")
        .eq("id", responseId)
        .eq("client_id", clientId)
        .eq("tenant_host", tenantHost)
        .maybeSingle();

      if (!existing) {
        return NextResponse.json(
          { success: false, error: "Respuesta no encontrada" },
          { status: 404 }
        );
      }

      const current = normalizeFormAnswers(existing.answers);

      if (Object.keys(patch).some((key) => !(key in current))) {
        return NextResponse.json(
          {
            success: false,
            error: "Solo se pueden corregir respuestas que el cliente envió",
          },
          { status: 400 }
        );
      }

      const previousMetadata =
        existing.metadata !== null &&
        typeof existing.metadata === "object" &&
        !Array.isArray(existing.metadata)
          ? (existing.metadata as Record<string, unknown>)
          : {};

      update = {
        answers: { ...current, ...patch },
        metadata: {
          ...previousMetadata,
          edited_by_trainer_at: new Date().toISOString(),
        },
      };
    } else if (answers) {
      update = { answers, metadata: metadata || {} };
    } else {
      update = { reviewed_at: reviewed ? new Date().toISOString() : null };
    }

    // Update response
    const { data: response, error } = await supabase
      .from("form_responses")
      .update(update)
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
    const { data: clientData, error: clientError } = await supabase
      .from("clients")
      .select("tenant")
      .eq("id", clientId)
      .single();

    if (clientError || !clientData) {
      return NextResponse.json(
        { success: false, error: "Cliente no encontrado" },
        { status: 404 }
      );
    }

    const { data: tenantData, error: tenantError } = await supabase
      .from("tenants")
      .select("host, trainer_id")
      .eq("trainer_id", clientData.tenant)
      .single();

    if (tenantError || !tenantData) {
      return NextResponse.json(
        { success: false, error: "Tenant no encontrado" },
        { status: 404 }
      );
    }

    const tenantHost = tenantData.host;

    if (tenantData.trainer_id !== session.trainer_id) {
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
