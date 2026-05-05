// GET /api/client/sessions
// Lista las sesiones de TODOS los programas activos del cliente
// (clásico: el mismo cliente suele tener un programa de fuerza Y uno de
// cardio activos a la vez). Es la fuente de "Escoge tu siguiente
// entrenamiento" en la pantalla principal del cliente.
//
// Sin programas activos → { program: null, programs: [], sessions: [] }
// y la UI muestra empty state.

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
  program_id: string;
}

interface ProgramSummary {
  id: string;
  name: string;
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

    // Sin filtro de status en el WHERE — replicamos el patrón de
    // /api/client/programs y filtramos en JS por robustez (mayúsculas,
    // espacios, etc.). El select trae start_date para ordenar luego.
    const { data: clientPrograms, error: clientProgramsError } = await supabase
      .from("client_programs")
      .select("id, program_id, status, start_date")
      .eq("client_id", clientId);

    if (clientProgramsError) {
      console.error(`${LOG_PREFIX} Error fetching client_programs:`, {
        correlationId,
        clientId,
        error: clientProgramsError.message,
      });

      return NextResponse.json(
        { success: false, error: "Error al obtener los programas" },
        { status: 500 }
      );
    }

    const activeClientPrograms = (clientPrograms ?? [])
      .filter(
        (cp) =>
          typeof cp.status === "string" &&
          cp.status.trim().toLowerCase() === "active"
      )
      .sort((a, b) => {
        const aDate = a.start_date ?? "";
        const bDate = b.start_date ?? "";

        return aDate < bDate ? 1 : aDate > bDate ? -1 : 0;
      });

    console.log(`${LOG_PREFIX} client_programs lookup:`, {
      correlationId,
      clientId,
      total: clientPrograms?.length ?? 0,
      active: activeClientPrograms.length,
      statusesSeen: Array.from(
        new Set((clientPrograms ?? []).map((cp) => cp.status))
      ),
    });

    if (activeClientPrograms.length === 0) {
      return NextResponse.json({
        success: true,
        program: null,
        programs: [],
        sessions: [],
      });
    }

    const programIds = Array.from(
      new Set(activeClientPrograms.map((cp) => cp.program_id))
    );

    const [programsResult, sessionsResult] = await Promise.all([
      supabase.from("programs").select("id, name").in("id", programIds),
      supabase
        .from("sessions")
        .select("id, name, session_type, duration_minutes, program_id")
        .in("program_id", programIds)
        .order("session_order", { ascending: true }),
    ]);

    if (programsResult.error) {
      console.error(`${LOG_PREFIX} Error fetching programs:`, {
        correlationId,
        programIds,
        error: programsResult.error.message,
      });

      return NextResponse.json(
        { success: false, error: "Error al obtener los programas" },
        { status: 500 }
      );
    }

    if (sessionsResult.error) {
      console.error(`${LOG_PREFIX} Error fetching sessions:`, {
        correlationId,
        programIds,
        error: sessionsResult.error.message,
      });

      return NextResponse.json(
        { success: false, error: "Error al obtener las sesiones" },
        { status: 500 }
      );
    }

    const programsMap = new Map<string, ProgramSummary>();

    for (const p of programsResult.data ?? []) {
      programsMap.set(p.id, { id: p.id, name: p.name });
    }

    // Mantén el orden por programa (más reciente primero) y luego por
    // session_order dentro de cada programa.
    const sessions = sessionsResult.data ?? [];
    const sessionList = await attachExerciseCounts(
      supabase,
      sessions,
      correlationId
    );

    sessionList.sort((a, b) => {
      const aIdx = programIds.indexOf(a.program_id);
      const bIdx = programIds.indexOf(b.program_id);

      return aIdx - bIdx;
    });

    // `program` (singular) se mantiene por compatibilidad con la spec
    // original — apunta al primer programa activo (más reciente). La UI
    // típicamente solo lo usa para detectar "hay programa activo".
    // `programs` (plural) es la fuente correcta cuando el cliente tiene
    // varios programas activos.
    const programsArray: ProgramSummary[] = programIds
      .map((id) => programsMap.get(id))
      .filter((p): p is ProgramSummary => p !== undefined);

    return NextResponse.json({
      success: true,
      program: programsArray[0] ?? null,
      programs: programsArray,
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
    program_id: string;
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
    program_id: s.program_id,
  }));
}
