// Trainer-scoped schedule for the Microciclo metrics view.
//
// Returns a per-date list of prescribed sessions for the client. Two sources:
//   1. Real `scheduled_sessions` rows (created lazily when the client logs).
//   2. The microcycle template (microcycles + microcycle_slots) materialized
//      to actual dates using client_program.start_date as the cycle anchor.
//
// Real rows win when both exist for the same date; the template fills gaps so
// the trainer sees the full prescribed week even when the client hasn't
// touched the app yet.

/* eslint-disable no-console */
import { NextRequest, NextResponse } from "next/server";

import { getTrainerSession } from "@/lib/auth/session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";
import {
  loadAllActiveOwnedPrograms,
  loadMicrocycleWithSlots,
} from "@/lib/microcycles/db";

const LOG_PREFIX = "[Trainer Scheduled Sessions API]";

interface SessionExercise {
  id: string;
  exercise_order: number;
  sets: number | null;
  reps: string | null;
  weight_kg: number | null;
  exercise: { id: string; name: string; category: string };
}

interface SessionWithExercises {
  id: string;
  name: string;
  session_exercises: SessionExercise[];
}

interface ScheduledSessionResponse {
  id: string;
  scheduled_date: string;
  status: string;
  completion_date: string | null;
  session: SessionWithExercises | null;
}

function diffDays(fromYmd: string, toYmd: string): number {
  const from = new Date(fromYmd + "T00:00:00").getTime();
  const to = new Date(toYmd + "T00:00:00").getTime();

  return Math.round((to - from) / (24 * 60 * 60 * 1000));
}

function daysBetween(startYmd: string, endYmd: string): string[] {
  const result: string[] = [];
  const start = new Date(startYmd + "T00:00:00");
  const end = new Date(endYmd + "T00:00:00");

  for (
    let d = new Date(start);
    d.getTime() <= end.getTime();
    d.setDate(d.getDate() + 1)
  ) {
    result.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    );
  }

  return result;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
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

    const { clientId } = await params;
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("id, tenant")
      .eq("id", clientId)
      .single();

    if (clientError || !client || client.tenant !== session.trainer_id) {
      return NextResponse.json(
        { success: false, error: "Cliente no encontrado" },
        { status: 404 }
      );
    }

    // 1. Real scheduled_sessions rows for the range (status, completion_date,
    //    and the linked session prescription).
    let realQuery = supabase
      .from("scheduled_sessions")
      .select(
        `id, scheduled_date, status, completion_date,
         session:sessions(
           id, name,
           session_exercises(
             id, exercise_order, sets, reps, weight_kg,
             exercise:exercises(id, name, category)
           )
         )`
      )
      .eq("client_id", clientId)
      .order("scheduled_date", { ascending: true });

    if (startDate) realQuery = realQuery.gte("scheduled_date", startDate);
    if (endDate) realQuery = realQuery.lte("scheduled_date", endDate);

    const { data: realRows, error: realError } = await realQuery;

    if (realError) {
      console.error(`${LOG_PREFIX} Error fetching scheduled_sessions:`, {
        correlationId,
        error: realError.message,
      });

      return NextResponse.json(
        { success: false, error: "Error al obtener sesiones programadas" },
        { status: 500 }
      );
    }

    const realByDate = new Map<string, ScheduledSessionResponse>();

    const realRowsTyped = (realRows ??
      []) as unknown as ScheduledSessionResponse[];

    for (const row of realRowsTyped) {
      realByDate.set(row.scheduled_date, row);
    }

    // 2. Materialize from the microcycle template: load every active
    //    client_program owned by this trainer, then walk slots → sessions →
    //    session_exercises and project per-date prescriptions.
    let templateByDate = new Map<string, ScheduledSessionResponse>();

    if (startDate && endDate) {
      templateByDate = await materializeTemplate(
        supabase,
        clientId,
        session.trainer_id,
        startDate,
        endDate,
        correlationId
      );
    }

    // 3. Merge: real rows beat template rows for the same date.
    const merged: ScheduledSessionResponse[] = [];
    const allDates = new Set<string>([
      ...realByDate.keys(),
      ...templateByDate.keys(),
    ]);

    for (const date of allDates) {
      merged.push(realByDate.get(date) ?? templateByDate.get(date)!);
    }

    merged.sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date));

    return NextResponse.json({ success: true, scheduledSessions: merged });
  } catch (error) {
    console.error(`${LOG_PREFIX} Unexpected:`, error);

    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

/**
 * Walks every active client_program owned by `trainerId` for `clientId`,
 * loads its microcycle slots, and projects a virtual ScheduledSessionResponse
 * for every date in [startDate, endDate] whose cycle slot points at a session.
 */
async function materializeTemplate(
  supabase: ReturnType<typeof createSupabaseClient>,
  clientId: string,
  trainerId: string,
  startDate: string,
  endDate: string,
  correlationId: string
): Promise<Map<string, ScheduledSessionResponse>> {
  const out = new Map<string, ScheduledSessionResponse>();

  const programs = await loadAllActiveOwnedPrograms(
    supabase,
    clientId,
    trainerId,
    correlationId
  );

  if (programs.length === 0) return out;

  const allSessionIds = new Set<string>();

  type ProgramCycle = {
    startDate: string;
    durationDays: number;
    slotByDayIndex: Map<number, string | null>;
  };
  const programCycles: ProgramCycle[] = [];

  for (const program of programs) {
    const microcycle = await loadMicrocycleWithSlots(
      supabase,
      program.id,
      correlationId
    );

    if (!microcycle || !program.start_date) continue;

    const slotByDayIndex = new Map<number, string | null>();

    for (const slot of microcycle.slots) {
      slotByDayIndex.set(slot.day_index, slot.session_id);
      if (slot.session_id) allSessionIds.add(slot.session_id);
    }

    programCycles.push({
      startDate: program.start_date,
      durationDays: microcycle.duration_days,
      slotByDayIndex,
    });
  }

  if (programCycles.length === 0) return out;

  // Load all referenced sessions with their session_exercises.
  const sessionMap = await loadSessionsWithExercises(
    supabase,
    Array.from(allSessionIds),
    correlationId
  );

  for (const date of daysBetween(startDate, endDate)) {
    for (const cycle of programCycles) {
      // Skip dates before this program's start.
      if (date < cycle.startDate) continue;

      const offset = diffDays(cycle.startDate, date);
      const dayIndex = (offset % cycle.durationDays) + 1;
      const sessionId = cycle.slotByDayIndex.get(dayIndex);

      if (!sessionId) continue;

      const sessionDetail = sessionMap.get(sessionId);

      if (!sessionDetail) continue;

      // First program that schedules this date wins (programs ordered by
      // start_date desc upstream — most recent program takes precedence).
      if (out.has(date)) continue;

      out.set(date, {
        id: `template:${cycle.startDate}:${dayIndex}:${date}`,
        scheduled_date: date,
        status: "scheduled",
        completion_date: null,
        session: sessionDetail,
      });
    }
  }

  return out;
}

async function loadSessionsWithExercises(
  supabase: ReturnType<typeof createSupabaseClient>,
  sessionIds: string[],
  correlationId: string
): Promise<Map<string, SessionWithExercises>> {
  if (sessionIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from("sessions")
    .select(
      `id, name,
       session_exercises(
         id, exercise_order, sets, reps, weight_kg,
         exercise:exercises(id, name, category)
       )`
    )
    .in("id", sessionIds);

  if (error) {
    console.error(`${LOG_PREFIX} Error loading sessions:`, {
      correlationId,
      error: error.message,
    });

    return new Map();
  }

  const map = new Map<string, SessionWithExercises>();
  const typed = (data ?? []) as unknown as SessionWithExercises[];

  for (const row of typed) {
    map.set(row.id, row);
  }

  return map;
}
