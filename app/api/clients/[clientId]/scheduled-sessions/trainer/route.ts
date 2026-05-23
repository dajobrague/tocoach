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

interface PrescribedSet {
  id: string;
  set_number: number;
  reps: string | null;
  weight_kg: number | null;
  notes: string | null;
}

interface OverrideExercise {
  id: string;
  exercise_order: number;
  sets: number | null;
  reps: string | null;
  weight_kg: number | null;
  duration_seconds: number | null;
  distance_meters: number | null;
  rest_seconds: number | null;
  notes: string | null;
  exercise: { id: string; name: string; category: string };
  prescribed_sets: PrescribedSet[];
}

interface ScheduledSessionResponse {
  id: string;
  scheduled_date: string;
  status: string;
  completion_date: string | null;
  /**
   * Sesión que se muestra como prescripción del día. Cuando el cliente
   * divergió del microciclo (entrenó otra sesión), `session` lleva la
   * sesión que ELIGIÓ entrenar (no la del template) para que la vista del
   * trainer muestre lo que pasó realmente: ejercicios, métricas y logs
   * alineados con la sesión efectivamente ejecutada.
   */
  session: SessionWithExercises | null;
  override_exercises: OverrideExercise[];
  /**
   * Sesión que el microciclo originalmente recomendaba para esta fecha,
   * presente solo cuando el cliente divergió. La UI la usa para mostrar un
   * chip informativo "Originalmente prescrito: X" sin pisar la prescripción
   * visible (ya reemplazada por lo que realmente entrenó).
   * `null` cuando no hay divergencia.
   */
  originally_prescribed_session: SessionWithExercises | null;
  /**
   * Marca quién creó la fila `scheduled_sessions` que respalda esta fecha.
   * 'trainer' = override explícito o template vacío; 'client' = el cliente
   * loggeó y no había override previo. La UI lo usa para tagging.
   */
  prescribed_by: "trainer" | "client" | null;
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
    //    prescribed_by, y la sesión vinculada con sus ejercicios prescritos).
    //
    // Traemos TODAS las filas (trainer y client), porque el merge en (3)
    // necesita distinguir tres escenarios:
    //   - prescribed_by='trainer': la prescripción es del trainer. Tal cual.
    //   - prescribed_by='client' + session matches template: el cliente entrenó
    //     lo recomendado. Mostrar status/completion_date como completado.
    //   - prescribed_by='client' + session diverge del template: split view —
    //     prescripción del template + badge "cliente entrenó X".
    let realQuery = supabase
      .from("scheduled_sessions")
      .select(
        `id, scheduled_date, status, completion_date, prescribed_by,
         session:sessions(
           id, name,
           session_exercises(
             id, exercise_order, sets, reps, weight_kg,
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
      // Skip cancelled/rescheduled rows: they should not count toward
      // adherence "prescribed" (the day was explicitly retired by the
      // trainer or client), otherwise the day stays "0/N pendiente"
      // forever and pollutes the microcycle metrics.
      .not("status", "in", '("cancelled","rescheduled")')
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

    // Key real rows on (date, session_id). Multiple rows per date are
    // now first-class — one per session the client/trainer touched.
    const realByKey = new Map<string, ScheduledSessionResponse>();
    const realRowsTyped = (realRows ??
      []) as unknown as ScheduledSessionResponse[];

    for (const row of realRowsTyped) {
      row.originally_prescribed_session = null;
      const key = `${row.scheduled_date}|${row.session?.id ?? ""}`;

      realByKey.set(key, row);
    }

    // 2. Materialize from the microcycle template — unchanged from
    //    before, indexed by date (one template row per date).
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

    // 3. Merge. Política por fecha:
    //    - Cada fila real (real, real, ...) se incluye tal cual; las
    //      prescribed_by='client' aparecen como actividad off-plan
    //      cuando su session_id diverge del template, o como sesión
    //      recomendada cuando coincide.
    //    - Si para la fecha existe slot de template y NO hay ninguna
    //      fila real con ese mismo session_id, agregamos la fila virtual
    //      del template (la prescripción pendiente).
    //    - Cuando hay divergencia entre fila real (cliente) y template,
    //      el real lleva `originally_prescribed_session` con la sesión
    //      del template para que la UI muestre el chip "Recomendado: X".

    const merged: ScheduledSessionResponse[] = [];
    const allDates = new Set<string>();

    for (const row of realRowsTyped) allDates.add(row.scheduled_date);
    for (const date of templateByDate.keys()) allDates.add(date);

    for (const date of allDates) {
      const template = templateByDate.get(date) ?? null;
      const realsForDate = realRowsTyped.filter(
        (r) => r.scheduled_date === date
      );

      // Determinar la "sesión recomendada" para la fecha: el pin del
      // trainer (real con prescribed_by='trainer') si existe; si no, el
      // session_id del template.
      const trainerPin =
        realsForDate.find((r) => r.prescribed_by === "trainer") ?? null;
      const recommendedSessionId = trainerPin
        ? (trainerPin.session?.id ?? null)
        : (template?.session?.id ?? null);

      // Emitir cada fila real con anotación de divergencia.
      for (const row of realsForDate) {
        if (
          row.prescribed_by === "client" &&
          recommendedSessionId != null &&
          row.session?.id !== recommendedSessionId
        ) {
          // Cliente entrenó algo distinto a lo recomendado: anotar la
          // sesión recomendada como "originalmente prescrito" para que
          // la UI le ponga el chip.
          row.originally_prescribed_session =
            trainerPin?.session ?? template?.session ?? null;
        }
        merged.push(row);
      }

      // Si el template recomienda una sesión y ninguna fila real la
      // cubre, agregar la fila virtual del template (prescripción
      // pendiente, sin actividad).
      if (
        template &&
        recommendedSessionId != null &&
        !realsForDate.some((r) => r.session?.id === recommendedSessionId)
      ) {
        // Si hay trainerPin con un session_id distinto al template, no
        // emitimos el template — el pin ya manda. Esto solo dispara
        // cuando no hay pin y el template recomienda una sesión que el
        // cliente no ha tocado todavía.
        if (!trainerPin) merged.push(template);
      }
    }

    merged.sort((a, b) => {
      if (a.scheduled_date !== b.scheduled_date) {
        return a.scheduled_date.localeCompare(b.scheduled_date);
      }

      // Estable dentro del día: trainer pin/prescripción primero,
      // actividad del cliente después.
      const aRank = a.prescribed_by === "trainer" ? 0 : 1;
      const bRank = b.prescribed_by === "trainer" ? 0 : 1;

      return aRank - bRank;
    });

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

    // Ancla del ciclo: microcycle.start_date (controlable por el trainer
    // desde la migración 108) en vez de program.start_date. Si por algún
    // motivo el microciclo no tiene start_date (no debería ocurrir tras
    // la migración + NOT NULL, pero defensivo), saltamos.
    if (!microcycle || !microcycle.start_date) continue;

    const slotByDayIndex = new Map<number, string | null>();

    for (const slot of microcycle.slots) {
      slotByDayIndex.set(slot.day_index, slot.session_id);
      if (slot.session_id) allSessionIds.add(slot.session_id);
    }

    programCycles.push({
      startDate: microcycle.start_date,
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
        override_exercises: [],
        originally_prescribed_session: null,
        prescribed_by: null,
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
