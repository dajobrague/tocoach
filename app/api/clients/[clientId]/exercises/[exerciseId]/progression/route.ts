// GET /api/clients/[clientId]/exercises/[exerciseId]/progression?days=365
// Vista de entrenador de la progresión de un cliente. Gemelo del endpoint del
// cliente (/api/client/exercises/[exerciseId]/progression): comparten
// fetchProgression, así que ambos lados ven exactamente los mismos números.
// La diferencia es la autorización: acá hay que verificar que el cliente
// pertenezca al entrenador antes de servir nada.

/* eslint-disable no-console */
import { NextRequest, NextResponse } from "next/server";

import { getTrainerSession } from "@/lib/auth/session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";
import {
  fetchProgression,
  parseDaysParam,
} from "@/lib/training/progression-query";

const LOG_PREFIX = "[Trainer Exercise Progression API]";

interface RouteContext {
  params: Promise<{ clientId: string; exerciseId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  const correlationId = `req-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const supabase = createSupabaseClient();

  try {
    const session = await getTrainerSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 401 }
      );
    }

    const { clientId, exerciseId } = await params;

    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("id, tenant")
      .eq("id", clientId)
      .single();

    if (clientError || !client || client.tenant !== session.trainer_id) {
      console.warn(`${LOG_PREFIX} Client not found or not owned by trainer:`, {
        correlationId,
        clientId,
        trainerId: session.trainer_id,
        clientTenant: client?.tenant,
      });

      return NextResponse.json(
        { success: false, error: "Cliente no encontrado" },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(request.url);
    const days = parseDaysParam(searchParams.get("days"));

    const progression = await fetchProgression(
      supabase,
      clientId,
      exerciseId,
      days
    );

    return NextResponse.json({ success: true, progression });
  } catch (error) {
    console.error(`${LOG_PREFIX} Unexpected error:`, {
      correlationId,
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
