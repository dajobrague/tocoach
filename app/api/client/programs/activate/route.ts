// POST /api/client/programs/activate
// El cliente elige su programa activo (chooser al entrar con varios
// activos, o "Activar" sobre un programa pausado). Activa el
// client_program indicado y pausa cualquier otro activo del cliente en
// una sola sentencia atómica (RPC activate_client_program) — invariante
// de un solo programa activo a la vez.

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
    const { data: demoted, error } = await supabase.rpc(
      "activate_client_program",
      {
        p_client_program_id: clientProgramId,
        p_client_id: clientId,
      }
    );

    if (error) {
      // P0002 (no_data_found) del RPC = el programa no pertenece al cliente.
      const notOwned = error.code === "P0002";

      console.error(`${LOG_PREFIX} RPC failed:`, {
        correlationId,
        clientId,
        clientProgramId,
        error: error.message,
      });

      return NextResponse.json(
        {
          success: false,
          error: notOwned
            ? "Programa no encontrado"
            : "Error al activar el programa",
        },
        { status: notOwned ? 404 : 500 }
      );
    }

    const demotedIds = (demoted ?? []).map(
      (row: { demoted_id: string }) => row.demoted_id
    );

    console.log(`${LOG_PREFIX} Program activated:`, {
      correlationId,
      clientId,
      clientProgramId,
      demotedCount: demotedIds.length,
    });

    return NextResponse.json({
      success: true,
      activatedId: clientProgramId,
      demotedIds,
    });
  } catch (error) {
    console.error(`${LOG_PREFIX} Unexpected error:`, { correlationId, error });

    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
