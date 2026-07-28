// GET /api/client/scheduled-sessions/[date]/state?sessionId=
// Estado de la fila scheduled_sessions de UNA sesión en UNA fecha, para la
// vista de sesión activa del cliente: hora de inicio declarada, status y si
// el completado fue manual. Devuelve data:null cuando la fila aún no existe
// (el cliente no ha iniciado ni guardado nada ese día).

/* eslint-disable no-console */
import { NextRequest, NextResponse } from "next/server";

import { getClientSession } from "@/lib/auth/client-session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";

const LOG_PREFIX = "[Client Session State API]";

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(
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
    const sessionId = new URL(request.url).searchParams.get("sessionId");

    if (!YMD_RE.test(date) || !sessionId) {
      return NextResponse.json(
        { success: false, error: "Parámetros inválidos" },
        { status: 400 }
      );
    }

    const supabase = createSupabaseClient();
    const clientId = parseInt(String(session.client_id), 10);

    const { data: row, error } = await supabase
      .from("scheduled_sessions")
      .select("id, status, scheduled_time, metadata")
      .eq("client_id", clientId)
      .eq("scheduled_date", date)
      .eq("session_id", sessionId)
      .maybeSingle();

    if (error) {
      console.error(`${LOG_PREFIX} fetch error:`, {
        correlationId,
        error: error.message,
      });

      return NextResponse.json(
        { success: false, error: "Error al obtener el estado" },
        { status: 500 }
      );
    }

    if (!row) {
      return NextResponse.json({ success: true, data: null });
    }

    const completedManually =
      row.metadata !== null &&
      typeof row.metadata === "object" &&
      (row.metadata as Record<string, unknown>).completed_manually === true;

    // TIME llega como "HH:MM:SS" — el cliente muestra/edita "HH:MM".
    const scheduledTime =
      typeof row.scheduled_time === "string"
        ? row.scheduled_time.slice(0, 5)
        : null;

    return NextResponse.json({
      success: true,
      data: {
        scheduledSessionId: row.id,
        status: row.status,
        scheduled_time: scheduledTime,
        completedManually,
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
