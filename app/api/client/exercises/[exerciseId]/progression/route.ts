// GET /api/client/exercises/[exerciseId]/progression?days=365
// Progresión de 1RM estimado + récords por rango de reps del cliente logueado.
// Gemelo del endpoint de entrenador
// (/api/clients/[clientId]/exercises/[exerciseId]/progression): misma consulta
// compartida, mismo contrato de respuesta — solo cambia de dónde sale el
// clientId (sesión propia acá, ownership del entrenador allá).

/* eslint-disable no-console */
import { NextRequest, NextResponse } from "next/server";

import { getClientSession } from "@/lib/auth/client-session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";
import {
  fetchProgression,
  parseDaysParam,
} from "@/lib/training/progression-query";

const LOG_PREFIX = "[Exercise Progression API]";

interface RouteContext {
  params: Promise<{ exerciseId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  const correlationId = `req-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const supabase = createSupabaseClient();

  try {
    const session = await getClientSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 401 }
      );
    }

    const { exerciseId } = await params;
    const { searchParams } = new URL(request.url);
    const days = parseDaysParam(searchParams.get("days"));

    const progression = await fetchProgression(
      supabase,
      session.client_id,
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
