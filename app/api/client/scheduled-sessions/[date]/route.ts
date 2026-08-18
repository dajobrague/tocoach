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
  loadMicrocyclesWithSlots,
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
  /**
   * Video subido directo a la app (bucket exercise-videos). Campo hermano
   * de video_url (enlace externo): la biblioteca del trainer permite ambos
   * y el cliente debe ver el que exista — omitirlo aquí dejaba invisibles
   * TODOS los videos subidos (solo los enlaces externos llegaban).
   */
  uploaded_video_url: string | null;
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
  /** Strength coaching meta (tempo, sistema de entrenamiento, RIR). */
  tempo: string | null;
  training_system: string | null;
  rir: string | null;
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
   *   - Con varios programas activos es la del programa PRIMARIO; el
   *     campo se mantiene por compatibilidad con bundles viejos.
   */
  trainer_recommended_session_id: string | null;
  /**
   * TODAS las sesiones recomendadas para el día, una por programa activo
   * que prescribe esta fecha (orden primario-primero, sin duplicados).
   * Con fuerza + cardio el mismo día, ambas llevan el badge "Recomendado".
   */
  trainer_recommended_session_ids: string[];
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
    const { data: ssRowsRaw, error: ssError } = await supabase
      .from("scheduled_sessions")
      .select(
        `id, session_id,
         session:sessions(id, name,
           session_exercises(
             id, exercise_order, sets, reps, weight_kg,
             duration_seconds, distance_meters, rest_seconds, notes, metadata,
             exercise:exercises(id, name, category, image_url, video_url, uploaded_video_url)
           )
         )`
      )
      .eq("client_id", clientId)
      .eq("scheduled_date", date);

    // Un fallo de query NO puede degradar a template/rest: eso ocultaría
    // la sesión que el cliente entrenó como si fuera un día de descanso.
    if (ssError) {
      console.error(
        `${LOG_PREFIX} scheduled_sessions query failed [${correlationId}]:`,
        ssError
      );

      return NextResponse.json(
        { success: false, error: "Error interno del servidor" },
        { status: 500 }
      );
    }

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

    // ── Compute the microcycle's recommendations for this date ────────
    // Siempre desde los slots del microciclo (uno por programa activo).
    // Las filas reales son actividad del cliente, no prescripción.
    const recPrograms = await loadPrograms();
    const recSlotMatches = await resolveMicrocycleSlots(
      supabase,
      recPrograms,
      date,
      correlationId
    );
    const trainerRecommendedSessionIds: string[] = recSlotMatches.map(
      (m) => m.sessionId
    );
    const trainerRecommendedSessionId: string | null =
      trainerRecommendedSessionIds[0] ?? null;

    // ── Compute current state for the PRESCRIBED session ──────────────
    // Si existe una fila real para esta fecha con su propia sesión,
    // construimos el día desde los session_exercises de esa sesión
    // (template data). Esto preserva el render de divergencia: el
    // cliente ve lo que efectivamente entrenó.
    // Con días fusionados puede haber varias filas reales el mismo día y
    // la query no trae .order(): elegimos DETERMINISTA — la recomendada
    // primaria si el cliente la entrenó, si no la de id menor. Las demás
    // sesiones del día no se renderizan aquí.
    const rowsWithExercises = ssRows.filter(
      (r) =>
        r.session &&
        Array.isArray(r.session.session_exercises) &&
        r.session.session_exercises.length > 0
    );
    const realRow =
      rowsWithExercises.find(
        (r) => r.session_id === trainerRecommendedSessionIds[0]
      ) ?? [...rowsWithExercises].sort((a, b) => (a.id < b.id ? -1 : 1))[0];

    if (realRow) {
      const sessionRow = realRow.session as any;
      const sessExercises = (sessionRow.session_exercises ?? []) as any[];
      const day = makeResolvedDay(
        date,
        "session",
        sessionRow,
        sessExercises,
        trainerRecommendedSessionIds
      );

      return NextResponse.json({
        success: true,
        day: await enrichWithLastUsedWeights(supabase, clientId, day),
      });
    }

    // 2. No real row — derive from microcycle template. Reuse the slots
    //    already resolved above (same supabase/programs/date → identical
    //    result) instead of re-querying. El día "por defecto" es la
    //    prescripción del programa PRIMARIO; el resto de recomendadas
    //    viajan en trainer_recommended_session_ids y el cliente las abre
    //    desde la lista de sesiones. Si la sesión del primario no carga
    //    (borrada/corrupta), caemos a la siguiente recomendada en vez de
    //    declarar "rest" con badges de recomendado vivos — sería
    //    contradictorio.
    for (const slotMatch of recSlotMatches) {
      const { data: sessionDetail } = await supabase
        .from("sessions")
        .select(
          `id, name,
           session_exercises(
             id, exercise_order, sets, reps, weight_kg,
             duration_seconds, distance_meters, rest_seconds, notes, metadata,
             exercise:exercises(id, name, category, image_url, video_url, uploaded_video_url)
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
          trainerRecommendedSessionIds
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
        trainer_recommended_session_ids: trainerRecommendedSessionIds,
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
 * devuelve TODAS las sesiones que los slots recomiendan para `date` — una
 * por programa activo que prescribe ese día, en orden primario-primero
 * (programs vienen ordenados por compareProgramPriority upstream) y sin
 * duplicar la misma sesión.
 *
 * El ancla del módulo es `microcycle.start_date` (no `program.start_date`)
 * desde la migración 108: el trainer escoge cuándo arranca el ciclo.
 */
async function resolveMicrocycleSlots(
  supabase: ReturnType<typeof createSupabaseClient>,
  programs: Awaited<ReturnType<typeof loadAllActiveOwnedPrograms>>,
  date: string,
  correlationId: string
): Promise<Array<{ sessionId: string }>> {
  const matches: Array<{ sessionId: string }> = [];
  const seen = new Set<string>();

  // 2 queries totales para todos los microciclos (antes: 2 por programa).
  // El walk completo sigue siendo necesario (todas las recomendadas del
  // día); el orden de precedencia lo da el array `programs`.
  const microcyclesByProgram = await loadMicrocyclesWithSlots(
    supabase,
    programs.map((program) => program.id),
    correlationId
  );

  for (const program of programs) {
    const microcycle = microcyclesByProgram.get(program.id);

    if (!microcycle?.start_date) continue;
    if (date < microcycle.start_date) continue;

    const offset = diffDays(microcycle.start_date, date);
    const dayIndex = (offset % microcycle.duration_days) + 1;
    const slot = microcycle.slots.find((s) => s.day_index === dayIndex);

    if (!slot?.session_id) continue;
    if (seen.has(slot.session_id)) continue;

    seen.add(slot.session_id);
    matches.push({ sessionId: slot.session_id });
  }

  return matches;
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
      uploaded_video_url?: string | null;
    };
  }>,
  trainerRecommendedSessionIds: string[]
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
        uploaded_video_url: r.exercise.uploaded_video_url ?? null,
        exercise_order: r.exercise_order,
        sets: r.sets,
        reps: r.reps,
        weight_kg: r.weight_kg,
        duration_seconds: r.duration_seconds,
        distance_meters: r.distance_meters,
        rest_seconds: r.rest_seconds,
        rest_description: readStr("rest_description"),
        // Notas del trainer: columna primero, fallback a metadata.notes —
        // mismo criterio que resolveStrengthCoachingFields (template path).
        // Sin el fallback, un comentario guardado solo en metadata se veía
        // cualquier día EXCEPTO el recomendado.
        notes:
          (typeof r.notes === "string" && r.notes.trim() !== ""
            ? r.notes
            : null) ?? readStr("notes"),
        intensity: readStr("intensity"),
        cardio_type: readStr("cardio_type"),
        heart_rate_min: readNum("heart_rate_min"),
        heart_rate_max: readNum("heart_rate_max"),
        tempo: readStr("tempo"),
        training_system: readStr("training_system"),
        rir: readStr("rir"),
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
    trainer_recommended_session_id: trainerRecommendedSessionIds[0] ?? null,
    trainer_recommended_session_ids: trainerRecommendedSessionIds,
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
