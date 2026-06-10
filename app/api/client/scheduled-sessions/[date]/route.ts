// GET /api/client/scheduled-sessions/[date]
// Returns the resolved prescription for one date: the row's own session
// (template) → microcycle template → rest. Used by the client app when
// opening a workout for a specific date. Divergence tracking and
// last-used-weight prefill are preserved.

/* eslint-disable no-console */
import { NextRequest, NextResponse } from "next/server";

import { getClientSession } from "@/lib/auth/client-session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";
import {
  loadAllActiveOwnedPrograms,
  loadMicrocycleWithSlots,
} from "@/lib/microcycles/db";

const LOG_PREFIX = "[Client Scheduled Session API]";

interface ResolvedExercise {
  session_exercise_id: string;
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
  /**
   * Descanso como texto libre (metadata.rest_description). El flujo de
   * add/edit en la página del cliente guarda el descanso SOLO aquí (nunca
   * escribe rest_seconds), así que omitirlo deja el descanso vacío en la
   * vista de sesión activa aunque el trainer lo haya configurado.
   */
  rest_description: string | null;
  notes: string | null;
  /**
   * Cardio coaching meta (intensidad subjetiva, tipo cardio, zona FC).
   * El SELECT debe incluir `metadata` de los session_exercises de cardio
   * para que estos campos lleguen al cliente; sin ellos isExerciseCardio()
   * falla y la sesión se renderiza en modo strength.
   */
  intensity: string | null;
  cardio_type: string | null;
  heart_rate_min: number | null;
  heart_rate_max: number | null;
  /** Strength coaching meta (tempo, sistema de entrenamiento). */
  tempo: string | null;
  training_system: string | null;
  /**
   * Pesos del último log finalizado del mismo cliente+ejercicio, indexados
   * por posición de set (0..N-1). El form usa estos valores para prellenar
   * inputs vacíos: si el trainer no prescribió peso, el cliente abre el
   * modal con su último peso usado ya cargado y no pierde la progresión
   * por olvido. `[]` cuando el cliente nunca finalizó ese ejercicio.
   */
  last_used_weights: Array<number | null>;
}

interface ResolvedDay {
  date: string;
  source: "session" | "template" | "rest";
  session: { id: string; name: string } | null;
  exercises: ResolvedExercise[];
  /**
   * Sesión que el microciclo recomienda para este día. Independiente de
   * `session`, que refleja el estado actual del día (puede haber sido
   * sobrescrito por una elección del cliente al loguear).
   *
   * Reglas:
   *   - Se calcula desde el slot del microciclo para esa fecha.
   *   - null = no hay recomendación (rest day o sin microciclo/programa).
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

    // 1. All real scheduled_sessions rows for this date. After
    //    migration 113 there can be multiple — one per session the
    //    client touched. Each row carries its own session (template
    //    data) used to render what the client actually trained.
    const { data: ssRowsRaw } = await supabase
      .from("scheduled_sessions")
      .select(
        `id, session_id,
         session:sessions(id, name,
           session_exercises(
             id, exercise_order, sets, reps, weight_kg,
             duration_seconds, distance_meters, rest_seconds, notes, metadata,
             exercise:exercises(id, name, category, image_url, video_url)
           )
         )`
      )
      .eq("client_id", clientId)
      .eq("scheduled_date", date);

    const ssRows = (ssRowsRaw ?? []) as any[];

    // Cache las queries de programas/microciclo: el cómputo de
    // trainer_recommended_session_id las necesita. Cargamos a demanda
    // (una sola vez) y reusamos el resultado del slot en el fallback.
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

    // ── Compute the microcycle's recommendation for this date ─────────
    // Siempre desde el slot del microciclo. Las filas reales son
    // actividad del cliente, no prescripción.
    const recPrograms = await loadPrograms();
    const recSlotMatch = await resolveMicrocycleSlot(
      supabase,
      recPrograms,
      date,
      correlationId
    );
    const trainerRecommendedSessionId: string | null =
      recSlotMatch?.sessionId ?? null;

    // ── Compute current state for the PRESCRIBED session ──────────────
    // Si existe una fila real para esta fecha con su propia sesión,
    // construimos el día desde los session_exercises de esa sesión
    // (template data). Esto preserva el render de divergencia: el
    // cliente ve lo que efectivamente entrenó.
    // First scheduled_sessions row with exercises wins; additional
    // same-date sessions are not rendered here.
    const realRow = ssRows.find(
      (r) =>
        r.session &&
        Array.isArray(r.session.session_exercises) &&
        r.session.session_exercises.length > 0
    );

    if (realRow) {
      const sessionRow = realRow.session as any;
      const sessExercises = (sessionRow.session_exercises ?? []) as any[];
      const day = makeResolvedDay(
        date,
        "session",
        sessionRow,
        sessExercises,
        trainerRecommendedSessionId
      );

      return NextResponse.json({
        success: true,
        day: await enrichWithLastUsedWeights(supabase, clientId, day),
      });
    }

    // 2. No real row — derive from microcycle template. Reuse the slot
    //    already resolved above (same supabase/programs/date → identical
    //    result) instead of re-querying.
    const slotMatch = recSlotMatch;

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
        const day = makeResolvedDay(
          date,
          "template",
          sessionDetail as any,
          ((sessionDetail as any).session_exercises ?? []) as any[],
          trainerRecommendedSessionId
        );

        return NextResponse.json({
          success: true,
          day: await enrichWithLastUsedWeights(supabase, clientId, day),
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
    id: string;
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
  }>,
  trainerRecommendedSessionId: string | null
): ResolvedDay {
  const exercises = [...raws]
    .sort((a, b) => a.exercise_order - b.exercise_order)
    .map((r) => {
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
        session_exercise_id: r.id,
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
        rest_description: readStr("rest_description"),
        notes: r.notes,
        intensity: readStr("intensity"),
        cardio_type: readStr("cardio_type"),
        heart_rate_min: readNum("heart_rate_min"),
        heart_rate_max: readNum("heart_rate_max"),
        tempo: readStr("tempo"),
        training_system: readStr("training_system"),
        // Se completa después con enrichWithLastUsedWeights — la query
        // necesita el supabase client y el clientId, que viven en el GET
        // handler, así que makeResolvedDay deja el array vacío como
        // placeholder y el caller hace el enriquecimiento en una sola
        // query batch para todos los ejercicios del día.
        last_used_weights: [] as Array<number | null>,
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

/**
 * Para cada ejercicio del día, busca el último exercise_log FINALIZADO
 * del mismo cliente+ejercicio e inyecta los `weight_kg` de sus sets
 * ordenados por `set_number`. Una sola query batch para todos los
 * ejercicios del día. El cliente usa estos pesos para prellenar inputs
 * vacíos del form de log (evita pérdida de progresión por olvido).
 */
async function enrichWithLastUsedWeights(
  supabase: ReturnType<typeof createSupabaseClient>,
  clientId: string,
  day: ResolvedDay
): Promise<ResolvedDay> {
  const exerciseIds = day.exercises
    .map((e) => e.exercise_id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);

  if (exerciseIds.length === 0) return day;

  const { data: logs, error } = await supabase
    .from("exercise_logs")
    .select(
      "exercise_id, completed_at, exercise_log_sets(set_number, weight_kg)"
    )
    .eq("client_id", clientId)
    .in("exercise_id", exerciseIds)
    .not("finalized_at", "is", null)
    .order("completed_at", { ascending: false });

  if (error) {
    console.warn(`${LOG_PREFIX} last_used_weights query failed:`, error);

    return day;
  }

  // Conservar solo el log MÁS RECIENTE por exercise_id (la query viene
  // ordenada desc, así que el primer hit gana).
  const lastByExId = new Map<string, Array<number | null>>();

  for (const log of (logs ?? []) as Array<{
    exercise_id: string;
    exercise_log_sets: Array<{ set_number: number; weight_kg: unknown }> | null;
  }>) {
    if (lastByExId.has(log.exercise_id)) continue;
    const setsRaw = log.exercise_log_sets ?? [];
    const sorted = [...setsRaw].sort((a, b) => a.set_number - b.set_number);
    const weights = sorted.map((s) => {
      const n =
        typeof s.weight_kg === "number"
          ? s.weight_kg
          : s.weight_kg != null
            ? Number(s.weight_kg)
            : null;

      return n != null && Number.isFinite(n) ? n : null;
    });

    lastByExId.set(log.exercise_id, weights);
  }

  return {
    ...day,
    exercises: day.exercises.map((ex) => ({
      ...ex,
      last_used_weights: lastByExId.get(ex.exercise_id) ?? [],
    })),
  };
}
