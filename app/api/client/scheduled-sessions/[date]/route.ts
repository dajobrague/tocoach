// GET /api/client/scheduled-sessions/[date]
// Returns the resolved prescription for one date applying the override
// precedence: scheduled_session_exercises → session.session_exercises →
// microcycle template. Used by the client app when opening a workout for
// a specific date.

/* eslint-disable no-console */
import { NextRequest, NextResponse } from "next/server";

import { getClientSession } from "@/lib/auth/client-session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";
import {
  loadAllActiveOwnedPrograms,
  loadMicrocycleWithSlots,
} from "@/lib/microcycles/db";

const LOG_PREFIX = "[Client Scheduled Session API]";

interface ResolvedSet {
  set_number: number;
  reps: string | null;
  weight_kg: number | null;
}

interface ResolvedExercise {
  exercise_id: string;
  name: string;
  category: string;
  exercise_order: number;
  sets: number | null;
  reps: string | null;
  weight_kg: number | null;
  duration_seconds: number | null;
  distance_meters: number | null;
  rest_seconds: number | null;
  notes: string | null;
  /** Per-set values when the override has them (Phase 3.5). Empty = uniform. */
  prescribed_sets: ResolvedSet[];
}

interface ResolvedDay {
  date: string;
  source: "override" | "session" | "template" | "rest";
  session: { id: string; name: string } | null;
  exercises: ResolvedExercise[];
}

function isYmd(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function diffDays(fromYmd: string, toYmd: string): number {
  const from = new Date(fromYmd + "T00:00:00").getTime();
  const to = new Date(toYmd + "T00:00:00").getTime();

  return Math.round((to - from) / (24 * 60 * 60 * 1000));
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ date: string }> }
) {
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

    const { date } = await params;

    if (!isYmd(date)) {
      return NextResponse.json(
        { success: false, error: "date inválido" },
        { status: 400 }
      );
    }

    const clientId = String(session.client_id);

    // 1. Real scheduled_sessions row for this date (with override + template).
    const { data: ssRow } = await supabase
      .from("scheduled_sessions")
      .select(
        `id,
         session:sessions(id, name,
           session_exercises(
             id, exercise_order, sets, reps, weight_kg,
             duration_seconds, distance_meters, rest_seconds, notes,
             exercise:exercises(id, name, category)
           )
         ),
         override_exercises:scheduled_session_exercises(
           id, exercise_order, sets, reps, weight_kg,
           duration_seconds, distance_meters, rest_seconds, notes,
           exercise:exercises(id, name, category),
           prescribed_sets:scheduled_session_exercise_sets(
             id, set_number, reps, weight_kg, notes
           )
         )`
      )
      .eq("client_id", clientId)
      .eq("scheduled_date", date)
      .maybeSingle();

    if (ssRow) {
      const overrides = (ssRow.override_exercises ?? []) as any[];

      if (overrides.length > 0) {
        return NextResponse.json({
          success: true,
          day: makeResolvedDay(
            date,
            "override",
            ssRow.session as any,
            overrides
          ),
        });
      }

      const sessionRow = ssRow.session as any;
      const sessExercises = (sessionRow?.session_exercises ?? []) as any[];

      return NextResponse.json({
        success: true,
        day: makeResolvedDay(date, "session", sessionRow, sessExercises),
      });
    }

    // 2. No real row — derive from microcycle template.
    const programs = await loadAllActiveOwnedPrograms(
      supabase,
      clientId,
      null,
      correlationId
    );

    for (const program of programs) {
      if (!program.start_date) continue;
      const microcycle = await loadMicrocycleWithSlots(
        supabase,
        program.id,
        correlationId
      );

      if (!microcycle) continue;
      if (date < program.start_date) continue;

      const offset = diffDays(program.start_date, date);
      const dayIndex = (offset % microcycle.duration_days) + 1;
      const slot = microcycle.slots.find((s) => s.day_index === dayIndex);

      if (!slot?.session_id) continue;

      const { data: sessionDetail } = await supabase
        .from("sessions")
        .select(
          `id, name,
           session_exercises(
             id, exercise_order, sets, reps, weight_kg,
             duration_seconds, distance_meters, rest_seconds, notes,
             exercise:exercises(id, name, category)
           )`
        )
        .eq("id", slot.session_id)
        .maybeSingle();

      if (!sessionDetail) continue;

      return NextResponse.json({
        success: true,
        day: makeResolvedDay(
          date,
          "template",
          sessionDetail as any,
          ((sessionDetail as any).session_exercises ?? []) as any[]
        ),
      });
    }

    // 3. No prescription at all → rest day.
    return NextResponse.json({
      success: true,
      day: {
        date,
        source: "rest",
        session: null,
        exercises: [],
      } satisfies ResolvedDay,
    });
  } catch (error) {
    console.error(`${LOG_PREFIX} unexpected:`, error);

    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

function makeResolvedDay(
  date: string,
  source: ResolvedDay["source"],
  session: { id: string; name: string } | null,
  raws: Array<{
    exercise_order: number;
    sets: number | null;
    reps: string | null;
    weight_kg: number | null;
    duration_seconds: number | null;
    distance_meters: number | null;
    rest_seconds: number | null;
    notes: string | null;
    exercise: { id: string; name: string; category: string };
    prescribed_sets?: Array<{
      set_number: number;
      reps: string | null;
      weight_kg: number | null;
    }> | null;
  }>
): ResolvedDay {
  const exercises = [...raws]
    .sort((a, b) => a.exercise_order - b.exercise_order)
    .map((r) => {
      const sets = (r.prescribed_sets ?? [])
        .slice()
        .sort((a, b) => a.set_number - b.set_number)
        .map((s) => ({
          set_number: s.set_number,
          reps: s.reps,
          weight_kg: s.weight_kg,
        }));

      return {
        exercise_id: r.exercise.id,
        name: r.exercise.name,
        category: r.exercise.category,
        exercise_order: r.exercise_order,
        sets: r.sets,
        reps: r.reps,
        weight_kg: r.weight_kg,
        duration_seconds: r.duration_seconds,
        distance_meters: r.distance_meters,
        rest_seconds: r.rest_seconds,
        notes: r.notes,
        prescribed_sets: sets,
      };
    });

  return {
    date,
    source,
    session: session ? { id: session.id, name: session.name } : null,
    exercises,
  };
}
