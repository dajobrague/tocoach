import { NextRequest, NextResponse } from "next/server";

import { getClientSession } from "@/lib/auth/client-session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";
import {
  scheduledRowHasLogs,
  sessionProgramIsActiveForClient,
} from "@/lib/microcycles/db";

// Estados que el cliente puede escribir vía PUT. Antes se aplicaba el body
// sin validar — cualquier string acababa en la columna.
const CLIENT_ALLOWED_STATUSES = new Set([
  "scheduled",
  "pending",
  "completed",
  "cancelled",
]);

// PUT - Update a scheduled session (reschedule or change status)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string; sessionId: string }> }
) {
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

    const { clientId, sessionId } = await params;
    const body = await request.json();
    const { scheduledDate, status, completedAt, notes } = body;

    // Verify client is updating their own session
    if (session.client_id.toString() !== clientId) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 403 }
      );
    }

    console.log("[Scheduled Session Update API] Updating:", sessionId, body);

    if (status !== undefined && CLIENT_ALLOWED_STATUSES.has(status) === false) {
      return NextResponse.json(
        { success: false, error: "status inválido" },
        { status: 400 }
      );
    }

    // Fila + programa dueño de su sesión, para el guard pausar=ocultar.
    const { data: existing, error: existingError } = await supabase
      .from("scheduled_sessions")
      .select("scheduled_date, metadata, session:sessions(program_id)")
      .eq("id", sessionId)
      .eq("client_id", clientId)
      .single();

    if (existingError || !existing) {
      return NextResponse.json(
        { success: false, error: "Sesión programada no encontrada" },
        { status: 404 }
      );
    }

    // Pausar = ocultar: mover o cambiar el estado de una fila cuyo programa
    // no está activo solo se permite si tiene entrenamiento real (misma
    // regla que /complete) — sin esto, un PUT movía prescripciones ocultas
    // o fabricaba un 'completed' que las hacía visibles para siempre.
    const existingSession = existing.session as
      | { program_id?: string | null }
      | { program_id?: string | null }[]
      | null;
    const rowProgramId = Array.isArray(existingSession)
      ? (existingSession[0]?.program_id ?? null)
      : (existingSession?.program_id ?? null);
    const programIsActive = await sessionProgramIsActiveForClient(
      supabase,
      clientId,
      rowProgramId,
      `sched-put-${sessionId}`
    );

    if (programIsActive === null) {
      return NextResponse.json(
        {
          success: false,
          error: "No se pudo verificar el programa. Inténtalo de nuevo.",
        },
        { status: 503 }
      );
    }

    if (programIsActive === false) {
      const hasLogs = await scheduledRowHasLogs(
        supabase,
        sessionId,
        `sched-put-${sessionId}`
      );

      // null = probe de logs falló: 503 reintentable, no un 409 que culpe
      // al trainer sin haber podido verificar.
      if (hasLogs === null) {
        return NextResponse.json(
          {
            success: false,
            error: "No se pudo verificar el entrenamiento. Inténtalo de nuevo.",
          },
          { status: 503 }
        );
      }

      if (hasLogs === false) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Este entrenamiento ya no está disponible: tu entrenador pausó el programa.",
          },
          { status: 409 }
        );
      }
    }

    // Build update object
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    // When rescheduling, persist the original template date so the UI can
    // suppress the old template slot and show the card on the new date.
    if (scheduledDate !== undefined) {
      const prevMeta = (existing.metadata as Record<string, any>) || {};

      if (!prevMeta.original_plan_date) {
        prevMeta.original_plan_date = existing.scheduled_date;
      }
      updateData.metadata = prevMeta;

      updateData.scheduled_date = scheduledDate;
    }

    if (status !== undefined) updateData.status = status;
    // NOTE: `completed_at` column does NOT exist on `scheduled_sessions` in
    // production. Writing to it returned PostgREST error PGRST204 ("Could
    // not find the 'completed_at' column ... in the schema cache") and
    // rejected the entire UPDATE — observed in Railway logs on
    // 2026-04-30 15:32+ when the new "Marcar como completado" UI started
    // sending the field. We accept `completedAt` in the body for backwards
    // compatibility but we no longer write it. If the column is added later,
    // restore: `if (completedAt !== undefined) updateData.completed_at = completedAt;`
    void completedAt;
    if (notes !== undefined) updateData.notes = notes;

    // Update the scheduled session
    const { data: updatedSession, error: updateError } = await supabase
      .from("scheduled_sessions")
      .update(updateData)
      .eq("id", sessionId)
      .eq("client_id", clientId)
      .select()
      .single();

    if (updateError || !updatedSession) {
      console.error("[Scheduled Session Update API] Error:", updateError);

      return NextResponse.json(
        { success: false, error: "Error al actualizar sesión programada" },
        { status: 500 }
      );
    }

    console.log("[Scheduled Session Update API] Updated:", updatedSession.id);

    return NextResponse.json({
      success: true,
      scheduledSession: updatedSession,
    });
  } catch (error) {
    console.error("[Scheduled Session Update API] Unexpected error:", error);

    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a scheduled session
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string; sessionId: string }> }
) {
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

    const { clientId, sessionId } = await params;

    // Verify client is deleting their own session
    if (session.client_id.toString() !== clientId) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 403 }
      );
    }

    console.log("[Scheduled Session Delete API] Deleting:", sessionId);

    // Delete the scheduled session
    const { error: deleteError } = await supabase
      .from("scheduled_sessions")
      .delete()
      .eq("id", sessionId)
      .eq("client_id", clientId);

    if (deleteError) {
      console.error("[Scheduled Session Delete API] Error:", deleteError);

      return NextResponse.json(
        { success: false, error: "Error al eliminar sesión programada" },
        { status: 500 }
      );
    }

    console.log("[Scheduled Session Delete API] Deleted:", sessionId);

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("[Scheduled Session Delete API] Unexpected error:", error);

    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
