// POST /api/client/programs/activate
// "Activar" sobre un programa pausado en la pestaña Programas. Activa el
// client_program indicado y NO toca el resto: pueden convivir varios
// programas activos (fuerza + cardio). El scoping por client_id de la
// sesión evita activar programas ajenos.

/* eslint-disable no-console */
import { NextRequest, NextResponse } from "next/server";

import { getClientSession } from "@/lib/auth/client-session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";

const LOG_PREFIX = "[Client Program Activate API]";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  const correlationId = `req-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  try {
    const session = await getClientSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => null);
    const clientProgramId =
      typeof body?.clientProgramId === "string" ? body.clientProgramId : null;

    if (!clientProgramId || !UUID_RE.test(clientProgramId)) {
      return NextResponse.json(
        { success: false, error: "clientProgramId es requerido" },
        { status: 400 }
      );
    }

    const clientId = parseInt(String(session.client_id), 10);

    if (isNaN(clientId)) {
      return NextResponse.json(
        { success: false, error: "Sesión inválida" },
        { status: 400 }
      );
    }

    const supabase = createSupabaseClient();
    const { data: updated, error } = await supabase
      .from("client_programs")
      .update({ status: "active", updated_at: new Date().toISOString() })
      .eq("id", clientProgramId)
      .eq("client_id", clientId)
      .select("id")
      .maybeSingle();

    if (error) {
      console.error(`${LOG_PREFIX} Update failed:`, {
        correlationId,
        clientId,
        clientProgramId,
        error: error.message,
      });

      return NextResponse.json(
        { success: false, error: "Error al activar el programa" },
        { status: 500 }
      );
    }

    if (!updated) {
      return NextResponse.json(
        { success: false, error: "Programa no encontrado" },
        { status: 404 }
      );
    }

    console.log(`${LOG_PREFIX} Program activated:`, {
      correlationId,
      clientId,
      clientProgramId,
    });

    // demotedIds se mantiene (vacío) por compatibilidad de shape con el
    // hook useActivateProgram.
    return NextResponse.json({
      success: true,
      activatedId: clientProgramId,
      demotedIds: [],
    });
  } catch (error) {
    console.error(`${LOG_PREFIX} Unexpected error:`, { correlationId, error });

    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
