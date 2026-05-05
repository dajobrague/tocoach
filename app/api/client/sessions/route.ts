// GET /api/client/sessions
// Lista las sesiones del programa activo del cliente autenticado.
// Es la fuente de "Escoge tu siguiente entrenamiento" en la pantalla
// principal del cliente. Sin programa activo → { program: null, sessions: [] }
// y la UI muestra un empty state.

/* eslint-disable no-console */
import type { SessionType } from "@/types/training";

import { NextRequest, NextResponse } from "next/server";

import { getClientSession } from "@/lib/auth/client-session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";

const LOG_PREFIX = "[Client Sessions API]";

interface SessionListItem {
  id: string;
  name: string;
  session_type: SessionType | null;
  duration_minutes: number | null;
  exercise_count: number;
}

export async function GET(_request: NextRequest) {
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

    const clientId = session.client_id;

    const { data: clientProgram, error: clientProgramError } = await supabase
      .from("client_programs")
      .select("id, program_id")
      .eq("client_id", clientId)
      .eq("status", "active")
      .order("start_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (clientProgramError) {
      console.error(`${LOG_PREFIX} Error fetching client_program:`, {
        correlationId,
        clientId,
        error: clientProgramError.message,
      });

      return NextResponse.json(
        { success: false, error: "Error al obtener el programa activo" },
        { status: 500 }
      );
    }

    if (!clientProgram) {
      return NextResponse.json({
        success: true,
        program: null,
        sessions: [],
      });
    }

    const { data: program, error: programError } = await supabase
      .from("programs")
      .select("id, name")
      .eq("id", clientProgram.program_id)
      .maybeSingle();

    if (programError || !program) {
      console.error(`${LOG_PREFIX} Error fetching program:`, {
        correlationId,
        clientId,
        programId: clientProgram.program_id,
        error: programError?.message,
      });

      return NextResponse.json(
        { success: false, error: "Error al obtener el programa" },
        { status: 500 }
      );
    }

    const { data: sessions, error: sessionsError } = await supabase
      .from("sessions")
      .select("id, name, session_type, duration_minutes")
      .eq("program_id", clientProgram.program_id)
      .order("session_order", { ascending: true });

    if (sessionsError) {
      console.error(`${LOG_PREFIX} Error fetching sessions:`, {
        correlationId,
        clientId,
        programId: clientProgram.program_id,
        error: sessionsError.message,
      });

      return NextResponse.json(
        { success: false, error: "Error al obtener las sesiones" },
        { status: 500 }
      );
    }

    const sessionList: SessionListItem[] = await attachExerciseCounts(
      supabase,
      sessions ?? [],
      correlationId
    );

    return NextResponse.json({
      success: true,
      program: { id: program.id, name: program.name },
      sessions: sessionList,
    });
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

// Counts session_exercises per session in a single grouped query (one round-trip
// instead of N). Returns sessions with `exercise_count` populated, preserving
// the original order.
async function attachExerciseCounts(
  supabase: ReturnType<typeof createSupabaseClient>,
  sessions: Array<{
    id: string;
    name: string;
    session_type: SessionType | null;
    duration_minutes: number | null;
  }>,
  correlationId: string
): Promise<SessionListItem[]> {
  if (sessions.length === 0) return [];

  const sessionIds = sessions.map((s) => s.id);

  const { data: exerciseRows, error } = await supabase
    .from("session_exercises")
    .select("session_id")
    .in("session_id", sessionIds);

  if (error) {
    console.warn(`${LOG_PREFIX} Failed to count exercises, defaulting to 0:`, {
      correlationId,
      error: error.message,
    });
  }

  const counts = new Map<string, number>();

  for (const row of exerciseRows ?? []) {
    counts.set(row.session_id, (counts.get(row.session_id) ?? 0) + 1);
  }

  return sessions.map((s) => ({
    id: s.id,
    name: s.name,
    session_type: s.session_type ?? null,
    duration_minutes: s.duration_minutes ?? null,
    exercise_count: counts.get(s.id) ?? 0,
  }));
}
