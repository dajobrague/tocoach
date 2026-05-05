// GET /api/client/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD
// Devuelve los entrenamientos completados del cliente en el rango.
// Solo status='completed'. Sin sugerencias futuras (decisión j del §1
// de bloque-1-spec.md).
//
// Response:
//   { entries: [ { scheduled_date, sessions: [{ id, name, session_type,
//                                               exercises_completed,
//                                               exercises_total }] } ] }

/* eslint-disable no-console */
import type { SessionType } from "@/types/training";

import { NextRequest, NextResponse } from "next/server";

import { getClientSession } from "@/lib/auth/client-session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";

const LOG_PREFIX = "[Client Calendar API]";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

interface CalendarEntrySession {
  id: string;
  name: string;
  session_type: SessionType | null;
  exercises_completed: number;
  exercises_total: number;
}

interface CalendarEntry {
  scheduled_date: string;
  sessions: CalendarEntrySession[];
}

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    if (!from || !to || !DATE_RE.test(from) || !DATE_RE.test(to)) {
      return NextResponse.json(
        {
          success: false,
          error: "Parámetros from y to deben tener formato YYYY-MM-DD",
        },
        { status: 400 }
      );
    }

    if (from > to) {
      return NextResponse.json(
        { success: false, error: "from no puede ser posterior a to" },
        { status: 400 }
      );
    }

    const { data: scheduled, error: scheduledError } = await supabase
      .from("scheduled_sessions")
      .select("id, scheduled_date, session_id")
      .eq("client_id", session.client_id)
      .eq("status", "completed")
      .gte("scheduled_date", from)
      .lte("scheduled_date", to)
      .order("scheduled_date", { ascending: true });

    if (scheduledError) {
      console.error(`${LOG_PREFIX} Error fetching scheduled_sessions:`, {
        correlationId,
        clientId: session.client_id,
        error: scheduledError.message,
      });

      return NextResponse.json(
        { success: false, error: "Error al obtener el calendario" },
        { status: 500 }
      );
    }

    const rows = scheduled ?? [];

    if (rows.length === 0) {
      return NextResponse.json({ success: true, entries: [] });
    }

    const sessionIds = Array.from(
      new Set(
        rows
          .map((r) => r.session_id)
          .filter((id): id is string => typeof id === "string")
      )
    );
    const scheduledIds = rows.map((r) => r.id);

    const [sessionsMap, completedCounts, totalCounts] = await Promise.all([
      loadSessionsMap(supabase, sessionIds, correlationId),
      countExerciseLogsByScheduled(supabase, scheduledIds, correlationId),
      countSessionExercisesBySession(supabase, sessionIds, correlationId),
    ]);

    const entries = groupByDate(
      rows,
      sessionsMap,
      completedCounts,
      totalCounts
    );

    return NextResponse.json({ success: true, entries });
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

async function loadSessionsMap(
  supabase: ReturnType<typeof createSupabaseClient>,
  sessionIds: string[],
  correlationId: string
): Promise<Map<string, { name: string; session_type: SessionType | null }>> {
  if (sessionIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from("sessions")
    .select("id, name, session_type")
    .in("id", sessionIds);

  if (error) {
    console.warn(`${LOG_PREFIX} Failed to load sessions, names blank:`, {
      correlationId,
      error: error.message,
    });

    return new Map();
  }

  const map = new Map<
    string,
    { name: string; session_type: SessionType | null }
  >();

  for (const row of data ?? []) {
    map.set(row.id, {
      name: row.name,
      session_type: (row.session_type ?? null) as SessionType | null,
    });
  }

  return map;
}

async function countExerciseLogsByScheduled(
  supabase: ReturnType<typeof createSupabaseClient>,
  scheduledIds: string[],
  correlationId: string
): Promise<Map<string, number>> {
  if (scheduledIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from("exercise_logs")
    .select("scheduled_session_id")
    .in("scheduled_session_id", scheduledIds);

  if (error) {
    console.warn(`${LOG_PREFIX} Failed to count exercise_logs:`, {
      correlationId,
      error: error.message,
    });

    return new Map();
  }

  const counts = new Map<string, number>();

  for (const row of data ?? []) {
    if (!row.scheduled_session_id) continue;
    counts.set(
      row.scheduled_session_id,
      (counts.get(row.scheduled_session_id) ?? 0) + 1
    );
  }

  return counts;
}

async function countSessionExercisesBySession(
  supabase: ReturnType<typeof createSupabaseClient>,
  sessionIds: string[],
  correlationId: string
): Promise<Map<string, number>> {
  if (sessionIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from("session_exercises")
    .select("session_id")
    .in("session_id", sessionIds);

  if (error) {
    console.warn(`${LOG_PREFIX} Failed to count session_exercises:`, {
      correlationId,
      error: error.message,
    });

    return new Map();
  }

  const counts = new Map<string, number>();

  for (const row of data ?? []) {
    counts.set(row.session_id, (counts.get(row.session_id) ?? 0) + 1);
  }

  return counts;
}

function groupByDate(
  rows: Array<{
    id: string;
    scheduled_date: string;
    session_id: string | null;
  }>,
  sessionsMap: Map<string, { name: string; session_type: SessionType | null }>,
  completedCounts: Map<string, number>,
  totalCounts: Map<string, number>
): CalendarEntry[] {
  const byDate = new Map<string, CalendarEntrySession[]>();

  for (const row of rows) {
    if (!row.session_id) continue; // scheduled sin session asociada (raro)

    const meta = sessionsMap.get(row.session_id);
    const sessionEntry: CalendarEntrySession = {
      id: row.session_id,
      name: meta?.name ?? "",
      session_type: meta?.session_type ?? null,
      exercises_completed: completedCounts.get(row.id) ?? 0,
      exercises_total: totalCounts.get(row.session_id) ?? 0,
    };

    const list = byDate.get(row.scheduled_date) ?? [];

    list.push(sessionEntry);
    byDate.set(row.scheduled_date, list);
  }

  return Array.from(byDate.entries())
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([scheduled_date, sessions]) => ({ scheduled_date, sessions }));
}
