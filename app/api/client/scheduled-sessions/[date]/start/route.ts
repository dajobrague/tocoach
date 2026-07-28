// POST /api/client/scheduled-sessions/[date]/start
// El cliente declara a qué hora empieza su entrenamiento (pedido de la
// llamada del 15 Jul). Materializa la fila de scheduled_sessions ANTES del
// primer log (vía el mismo RPC idempotente que usa el guardado de logs) y
// escribe scheduled_time — hora local del cliente, guardada tal cual.
// La respuesta incluye el id de la fila, que el cliente no conocía hasta
// ahora por el camino resolved-day (lo usa "marcar como completado").

/* eslint-disable no-console */
import { NextRequest, NextResponse } from "next/server";

import { getClientSession } from "@/lib/auth/client-session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";
import { loadTenantContext } from "@/lib/tenant/loader";

const LOG_PREFIX = "[Client Session Start API]";

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

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
    const time = typeof body?.time === "string" ? body.time : null;

    if (!sessionId || !time || !TIME_RE.test(time)) {
      return NextResponse.json(
        { success: false, error: "sessionId y time (HH:MM) son requeridos" },
        { status: 400 }
      );
    }

    const supabase = createSupabaseClient();
    const clientId = parseInt(String(session.client_id), 10);

    const [{ data: sessionData, error: sessionError }, tenant] =
      await Promise.all([
        supabase
          .from("sessions")
          .select("trainer_id, tenant_host")
          .eq("id", sessionId)
          .single(),
        loadTenantContext(session.tenant_slug),
      ]);

    // La sesión debe ser del MISMO tenant que el cliente autenticado — sin
    // esto un sessionId ajeno crearía filas con tenant_host de otro tenant.
    if (
      sessionError ||
      !sessionData ||
      tenant === null ||
      sessionData.tenant_host !== tenant.host
    ) {
      return NextResponse.json(
        { success: false, error: "Sesión no encontrada" },
        { status: 404 }
      );
    }

    // Mismo RPC atómico que el guardado de logs: si la fila ya existe la
    // devuelve sin tocar session_id/status/prescribed_by; si no, la crea.
    const { data: scheduledSessionId, error: upsertError } = await supabase.rpc(
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

    if (upsertError || !scheduledSessionId) {
      console.error(`${LOG_PREFIX} upsert error:`, {
        correlationId,
        error: upsertError?.message,
      });

      return NextResponse.json(
        { success: false, error: "Error al iniciar la sesión" },
        { status: 500 }
      );
    }

    // Última escritura gana: reiniciar o corregir la hora es válido.
    const { error: timeError } = await supabase
      .from("scheduled_sessions")
      .update({ scheduled_time: time })
      .eq("id", scheduledSessionId)
      .eq("client_id", clientId);

    if (timeError) {
      console.error(`${LOG_PREFIX} time write error:`, {
        correlationId,
        error: timeError.message,
      });

      return NextResponse.json(
        { success: false, error: "Error al guardar la hora" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { scheduledSessionId, scheduled_time: time },
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
