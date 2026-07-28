// POST /api/client/scheduled-sessions/[date]/complete
// "Marcar entrenamiento como completado" (pedido de la llamada del 15 Jul):
// el cliente puede dar la sesión por terminada aunque haya dejado ejercicios
// sin hacer (día flojo, máquina rota, etc.). Marca metadata.completed_manually
// para que el auto-completado y el downgrade al borrar logs no peleen con la
// decisión explícita del cliente.
//
// Body: { sessionId } → completar. { sessionId, undo: true } → deshacer:
// quita la marca y recalcula el estado con la misma regla de cobertura que
// usa el auto-completado (lib/training/session-completion).

/* eslint-disable no-console */
import { NextRequest, NextResponse } from "next/server";

import { getClientSession } from "@/lib/auth/client-session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";
import { isSessionFullyCovered } from "@/lib/training/session-completion";

const LOG_PREFIX = "[Client Session Complete API]";

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ date: string }> }
) {
  const correlationId = `req-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  try {
    const session = await getClientSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 401 }
      );
    }

    const { date } = await params;

    if (!YMD_RE.test(date)) {
      return NextResponse.json(
        { success: false, error: "Fecha inválida (YYYY-MM-DD)" },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => null);
    const sessionId =
      typeof body?.sessionId === "string" ? body.sessionId : null;
    const undo = body?.undo === true;

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: "sessionId es requerido" },
        { status: 400 }
      );
    }

    const supabase = createSupabaseClient();
    const clientId = parseInt(String(session.client_id), 10);

    const { data: row, error: rowError } = await supabase
      .from("scheduled_sessions")
      .select("id, status, metadata")
      .eq("client_id", clientId)
      .eq("scheduled_date", date)
      .eq("session_id", sessionId)
      .maybeSingle();

    if (rowError) {
      console.error(`${LOG_PREFIX} row fetch error:`, {
        correlationId,
        error: rowError.message,
      });

      return NextResponse.json(
        { success: false, error: "Error al buscar la sesión" },
        { status: 500 }
      );
    }

    if (undo) {
      return await undoManualComplete(supabase, row, sessionId, clientId);
    }

    // Completar sin fila previa (sesión sin ningún log guardado): crearla
    // primero con el mismo RPC atómico del guardado de logs.
    let scheduledId = row?.id ?? null;
    let metadata: Record<string, unknown> =
      row?.metadata !== null &&
      row?.metadata !== undefined &&
      typeof row.metadata === "object"
        ? { ...(row.metadata as Record<string, unknown>) }
        : {};

    if (scheduledId === null) {
      const { data: sessionData, error: sessionError } = await supabase
        .from("sessions")
        .select("trainer_id, tenant_host")
        .eq("id", sessionId)
        .single();

      if (sessionError || !sessionData) {
        return NextResponse.json(
          { success: false, error: "Sesión no encontrada" },
          { status: 404 }
        );
      }

      const { data: createdId, error: upsertError } = await supabase.rpc(
        "upsert_scheduled_session",
        {
          p_tenant_host: sessionData.tenant_host,
          p_client_id: clientId,
          p_trainer_id: sessionData.trainer_id,
          p_session_id: sessionId,
          p_scheduled_date: date,
          p_status: "scheduled",
          p_caller_role: "client",
        }
      );

      if (upsertError || !createdId) {
        console.error(`${LOG_PREFIX} upsert error:`, {
          correlationId,
          error: upsertError?.message,
        });

        return NextResponse.json(
          { success: false, error: "Error al crear la sesión" },
          { status: 500 }
        );
      }
      scheduledId = createdId;
      metadata = {};
    }

    metadata.completed_manually = true;
    metadata.completed_manually_at = new Date().toISOString();

    const { error: updateError } = await supabase
      .from("scheduled_sessions")
      .update({
        status: "completed",
        completion_date: new Date().toISOString(),
        metadata,
      })
      .eq("id", scheduledId)
      .eq("client_id", clientId);

    if (updateError) {
      console.error(`${LOG_PREFIX} complete error:`, {
        correlationId,
        error: updateError.message,
      });

      return NextResponse.json(
        { success: false, error: "Error al marcar como completado" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        scheduledSessionId: scheduledId,
        status: "completed",
        completedManually: true,
      },
    });
  } catch (error) {
    console.error(`${LOG_PREFIX} unexpected error:`, {
      correlationId,
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

/**
 * Deshacer: quita la marca manual y deja el estado como lo habría dejado el
 * auto-completado — 'completed' si la cobertura de logs finalizados es total,
 * 'scheduled' si no.
 */
async function undoManualComplete(
  supabase: ReturnType<typeof createSupabaseClient>,
  row: { id: string; status: string; metadata: unknown } | null,
  sessionId: string,
  clientId: number
): Promise<NextResponse> {
  if (row === null) {
    // Nada que deshacer.
    return NextResponse.json({
      success: true,
      data: {
        scheduledSessionId: null,
        status: null,
        completedManually: false,
      },
    });
  }

  const metadata: Record<string, unknown> =
    row.metadata !== null && typeof row.metadata === "object"
      ? { ...(row.metadata as Record<string, unknown>) }
      : {};

  delete metadata.completed_manually;
  delete metadata.completed_manually_at;

  let covered = false;

  try {
    covered = await isSessionFullyCovered(
      supabase,
      row.id,
      sessionId,
      clientId
    );
  } catch (error) {
    console.warn(`${LOG_PREFIX} coverage check failed on undo:`, {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const { error: updateError } = await supabase
    .from("scheduled_sessions")
    .update(
      covered
        ? { metadata }
        : { status: "scheduled", completion_date: null, metadata }
    )
    .eq("id", row.id)
    .eq("client_id", clientId);

  if (updateError) {
    return NextResponse.json(
      { success: false, error: "Error al deshacer" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    data: {
      scheduledSessionId: row.id,
      status: covered ? "completed" : "scheduled",
      completedManually: false,
    },
  });
}
