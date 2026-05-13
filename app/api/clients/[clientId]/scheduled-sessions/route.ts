import { NextRequest, NextResponse } from "next/server";

import { getClientSession } from "@/lib/auth/client-session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";

// GET - Fetch scheduled sessions for a client within a date range
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
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

    const { clientId } = await params;
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    // Verify client is requesting their own data
    if (session.client_id.toString() !== clientId) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 403 }
      );
    }

    let query = supabase
      .from("scheduled_sessions")
      .select("*")
      .eq("client_id", clientId)
      .order("scheduled_date", { ascending: true });

    if (startDate) {
      query = query.gte("scheduled_date", startDate);
    }
    if (endDate) {
      query = query.lte("scheduled_date", endDate);
    }

    const { data: scheduledSessions, error: sessionsError } = await query;

    if (sessionsError) {
      console.error("[Scheduled Sessions API] Error fetching:", sessionsError);

      return NextResponse.json(
        { success: false, error: "Error al obtener sesiones programadas" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      scheduledSessions: scheduledSessions || [],
    });
  } catch (error) {
    console.error("[Scheduled Sessions API] Unexpected error:", error);

    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// POST - Create a scheduled session
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
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

    const { clientId } = await params;
    const body = await request.json();
    const { sessionId, scheduledDate, status, originalPlanDate } = body;

    // Verify client is creating for themselves
    if (session.client_id.toString() !== clientId) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 403 }
      );
    }

    // Get the session to find trainer_id and tenant_host
    const { data: sessionData, error: sessionError } = await supabase
      .from("sessions")
      .select("trainer_id, tenant_host")
      .eq("id", sessionId)
      .single();

    if (sessionError || !sessionData) {
      console.error(
        "[Scheduled Sessions API] Session not found:",
        sessionError
      );

      return NextResponse.json(
        { success: false, error: "Sesión no encontrada" },
        { status: 404 }
      );
    }

    // Create scheduled session with original_plan_date anchor for reschedule tracking
    const metadata: Record<string, string> = {};

    if (originalPlanDate) {
      metadata.original_plan_date = originalPlanDate;
    }

    // Atomic upsert via RPC (F4.5 migration 104). Previene duplicados
    // bajo concurrencia (dos requests para el mismo client/date ven
    // SELECT vacío y ambas insertaban). p_caller_role='client' agregado
    // en migration 109 — esta endpoint autentica con getClientSession,
    // así que si crea una fila nueva la marca como elección del cliente.
    const { data: scheduledSessionId, error: upsertError } = await supabase.rpc(
      "upsert_scheduled_session",
      {
        p_tenant_host: sessionData.tenant_host,
        p_client_id: parseInt(clientId),
        p_trainer_id: sessionData.trainer_id,
        p_session_id: sessionId,
        p_scheduled_date: scheduledDate,
        p_status: status || "pending",
        p_metadata: Object.keys(metadata).length > 0 ? metadata : null,
        p_caller_role: "client",
      }
    );

    if (upsertError || !scheduledSessionId) {
      console.error("[Scheduled Sessions API] Error creating:", upsertError);

      return NextResponse.json(
        { success: false, error: "Error al crear sesión programada" },
        { status: 500 }
      );
    }

    const { data: scheduledSession } = await supabase
      .from("scheduled_sessions")
      .select("*")
      .eq("id", scheduledSessionId)
      .single();

    console.log("[Scheduled Sessions API] Created/Found:", scheduledSessionId);

    return NextResponse.json({
      success: true,
      scheduledSession,
    });
  } catch (error) {
    console.error("[Scheduled Sessions API] Unexpected error:", error);

    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
