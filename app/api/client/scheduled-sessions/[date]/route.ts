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
  /** Library image (when the trainer has one configured for this exercise). */
  image_url: string | null;
  /** Library reference/demo video (separate from per-set client uploads). */
  video_url: string | null;
  exercise_order: number;
  sets: number | null;
  reps: string | null;
  weight_kg: number | null;
  duration_seconds: number | null;
  distance_meters: number | null;
  rest_seconds: number | null;
  notes: string | null;
  /**
   * Cardio coaching meta (intensidad subjetiva, tipo cardio, zona FC).
   * Antes el SELECT no incluía `metadata` y los overrides de cardio
   * llegaban al cliente sin estos campos, así que isExerciseCardio()
   * fallaba y la sesión se renderizaba en modo strength.
   */
  intensity: string | null;
  cardio_type: string | null;
  heart_rate_min: number | null;
  heart_rate_max: number | null;
  /** Strength coaching meta (tempo, sistema de entrenamiento). */
  tempo: string | null;
  training_system: string | null;
  /** Per-set values when the override has them (Phase 3.5). Empty = uniform. */
  prescribed_sets: ResolvedSet[];
}

interface ResolvedDay {
  date: string;
  source: "override" | "session" | "template" | "rest";
  session: { id: string; name: string } | null;
  exercises: ResolvedExercise[];
  /**
   * Sesión que el trainer recomendó para este día (microciclo o
   * override por-fecha del trainer). Independiente de `session`, que
   * refleja el estado actual del día (puede haber sido sobrescrito
   * por una elección del cliente al loguear).
   *
   * Reglas:
   *   - Si scheduled_sessions existe con prescribed_by='trainer' y
   *     session_id no nulo → usar ese session_id (el trainer hizo
   *     un override explícito que tiene prioridad sobre el template).
   *   - Si no, calcular desde el slot del microciclo para esa fecha.
   *   - null = el trainer no recomendó nada (rest day o sin
   *     microciclo/programa).
   */
  trainer_recommended_session_id: string | null;
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
    //    SELECT incluye prescribed_by + session_id sueltos: necesitamos
    //    saber si la fila la creó el trainer o el cliente para distinguir
    //    "esto es lo recomendado por el trainer" de "esto es lo que el
    //    cliente eligió hacer".
    const { data: ssRow } = await supabase
      .from("scheduled_sessions")
      .select(
        `id, prescribed_by, session_id,
         session:sessions(id, name,
           session_exercises(
             id, exercise_order, sets, reps, weight_kg,
             duration_seconds, distance_meters, rest_seconds, notes, metadata,
             exercise:exercises(id, name, category, image_url, video_url)
           )
         ),
         override_exercises:scheduled_session_exercises(
           id, exercise_order, sets, reps, weight_kg,
           duration_seconds, distance_meters, rest_seconds, notes,
           exercise:exercises(id, name, category, image_url, video_url),
           prescribed_sets:scheduled_session_exercise_sets(
             id, set_number, reps, weight_kg, notes
           )
         )`
      )
      .eq("client_id", clientId)
      .eq("scheduled_date", date)
      .maybeSingle();

    // Cache las queries de programas/microciclo: el cómputo de
    // trainer_recommended_session_id puede necesitarlo, y el fallback
    // template también. Cargamos a demanda para no pagar el costo si la
    // ssRow ya satisface ambos lados.
    let programsCache: Awaited<
      ReturnType<typeof loadAllActiveOwnedPrograms>
    > | null = null;
    const loadPrograms = async () => {
      if (programsCache === null) {
        programsCache = await loadAllActiveOwnedPrograms(
          supabase,
          clientId,
          null,
          correlationId
        );
      }

      return programsCache;
    };

    // ── Compute trainer's recommendation for this date ────────────────
    // Prioridad: override del trainer en la fila > template del microciclo.
    // El cliente que sólo loguea no puede generar "recomendación" — esa
    // es siempre intención del trainer (microciclo o per-date override).
    let trainerRecommendedSessionId: string | null = null;

    if (
      ssRow?.prescribed_by === "trainer" &&
      typeof ssRow.session_id === "string"
    ) {
      trainerRecommendedSessionId = ssRow.session_id;
    } else {
      const programs = await loadPrograms();
      const slotMatch = await resolveMicrocycleSlot(
        supabase,
        programs,
        date,
        correlationId
      );

      trainerRecommendedSessionId = slotMatch?.sessionId ?? null;
    }

    // ── Compute current state (override / session / template / rest) ──
    if (ssRow) {
      const overrides = (ssRow.override_exercises ?? []) as any[];

      if (overrides.length > 0) {
        return NextResponse.json({
          success: true,
          day: makeResolvedDay(
            date,
            "override",
            ssRow.session as any,
            overrides,
            trainerRecommendedSessionId
          ),
        });
      }

      const sessionRow = ssRow.session as any;
      const sessExercises = (sessionRow?.session_exercises ?? []) as any[];

      // Only return "session" when there's actually a session linked with
      // exercises. An empty overrides array + no session_id on the row used
      // to fall through here as an empty "session" payload — distinct from
      // an intentional rest day. Fall through to template step instead so
      // the trainer's microcycle template still applies.
      if (sessionRow && sessExercises.length > 0) {
        return NextResponse.json({
          success: true,
          day: makeResolvedDay(
            date,
            "session",
            sessionRow,
            sessExercises,
            trainerRecommendedSessionId
          ),
        });
      }
    }

    // 2. No real row — derive from microcycle template.
    const programs = await loadPrograms();
    const slotMatch = await resolveMicrocycleSlot(
      supabase,
      programs,
      date,
      correlationId
    );

    if (slotMatch) {
      const { data: sessionDetail } = await supabase
        .from("sessions")
        .select(
          `id, name,
           session_exercises(
             id, exercise_order, sets, reps, weight_kg,
             duration_seconds, distance_meters, rest_seconds, notes, metadata,
             exercise:exercises(id, name, category, image_url, video_url)
           )`
        )
        .eq("id", slotMatch.sessionId)
        .maybeSingle();

      if (sessionDetail) {
        return NextResponse.json({
          success: true,
          day: makeResolvedDay(
            date,
            "template",
            sessionDetail as any,
            ((sessionDetail as any).session_exercises ?? []) as any[],
            trainerRecommendedSessionId
          ),
        });
      }
    }

    // 3. No prescription at all → rest day.
    return NextResponse.json({
      success: true,
      day: {
        date,
        source: "rest",
        session: null,
        exercises: [],
        trainer_recommended_session_id: trainerRecommendedSessionId,
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

/**
 * Camina los programas activos del cliente, carga sus microciclos, y
 * devuelve la sesión que el slot del microciclo recomienda para `date`.
 * El primer programa con un slot válido gana (programs vienen ordenados
 * desc por start_date upstream — el más reciente tiene precedencia).
 *
 * El ancla del modulo es `microcycle.start_date` (no `program.start_date`)
 * desde la migración 108: el trainer escoge cuándo arranca el ciclo.
 */
async function resolveMicrocycleSlot(
  supabase: ReturnType<typeof createSupabaseClient>,
  programs: Awaited<ReturnType<typeof loadAllActiveOwnedPrograms>>,
  date: string,
  correlationId: string
): Promise<{ sessionId: string } | null> {
  for (const program of programs) {
    const microcycle = await loadMicrocycleWithSlots(
      supabase,
      program.id,
      correlationId
    );

    if (!microcycle?.start_date) continue;
    if (date < microcycle.start_date) continue;

    const offset = diffDays(microcycle.start_date, date);
    const dayIndex = (offset % microcycle.duration_days) + 1;
    const slot = microcycle.slots.find((s) => s.day_index === dayIndex);

    if (!slot?.session_id) continue;

    return { sessionId: slot.session_id };
  }

  return null;
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
    metadata?: Record<string, unknown> | null;
    exercise: {
      id: string;
      name: string;
      category: string;
      image_url: string | null;
      video_url: string | null;
    };
    prescribed_sets?: Array<{
      set_number: number;
      reps: string | null;
      weight_kg: number | null;
    }> | null;
  }>,
  trainerRecommendedSessionId: string | null
): ResolvedDay {
  const exercises = [...raws]
    .sort((a, b) => a.exercise_order - b.exercise_order)
    .map((r) => {
      // Per-set NULL fall-through. If a per-set row has reps/weight NULL,
      // coalesce to the parent's uniform prescription so the documented
      // precedence (per-set > uniform > template) is respected per field
      // rather than per row.
      const sets = (r.prescribed_sets ?? [])
        .slice()
        .sort((a, b) => a.set_number - b.set_number)
        .map((s) => ({
          set_number: s.set_number,
          reps: s.reps ?? r.reps,
          weight_kg: s.weight_kg ?? r.weight_kg,
        }));

      const meta = (r.metadata ?? {}) as Record<string, unknown>;
      const readStr = (k: string): string | null => {
        const v = meta[k];

        return typeof v === "string" && v.trim() !== "" ? v : null;
      };
      const readNum = (k: string): number | null => {
        const v = meta[k];

        return typeof v === "number" && Number.isFinite(v) ? v : null;
      };

      return {
        exercise_id: r.exercise.id,
        name: r.exercise.name,
        category: r.exercise.category,
        image_url: r.exercise.image_url ?? null,
        video_url: r.exercise.video_url ?? null,
        exercise_order: r.exercise_order,
        sets: r.sets,
        reps: r.reps,
        weight_kg: r.weight_kg,
        duration_seconds: r.duration_seconds,
        distance_meters: r.distance_meters,
        rest_seconds: r.rest_seconds,
        notes: r.notes,
        intensity: readStr("intensity"),
        cardio_type: readStr("cardio_type"),
        heart_rate_min: readNum("heart_rate_min"),
        heart_rate_max: readNum("heart_rate_max"),
        tempo: readStr("tempo"),
        training_system: readStr("training_system"),
        prescribed_sets: sets,
      };
    });

  return {
    date,
    source,
    session: session ? { id: session.id, name: session.name } : null,
    exercises,
    trainer_recommended_session_id: trainerRecommendedSessionId,
  };
}
