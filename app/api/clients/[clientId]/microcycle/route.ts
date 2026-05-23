// GET / PUT /api/clients/[clientId]/microcycle
// Endpoints trainer-side para configurar el microciclo de
// un cliente. El microciclo se ancla al client_program más reciente
// (UNIQUE constraint en microcycles.client_program_id), pero las sesiones
// disponibles para los slots se traen de TODOS los programas activos del
// cliente — un cliente típicamente tiene fuerza + cardio simultáneamente
// y el trainer debe poder mezclar ambos en el microciclo.
//
// Replica el patrón de los otros endpoints trainer-on-client: auth con
// getTrainerSession + check de ownership implícito vía client_programs
// .trainer_id = session.trainer_id.

/* eslint-disable no-console */
import { NextRequest, NextResponse } from "next/server";

import { getTrainerSession } from "@/lib/auth/session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";
import {
  cleanFuturePrescribedRowsForReset,
  loadAllActiveOwnedPrograms,
  loadMicrocycleWithSlots,
  replaceSlots,
  upsertMicrocycle,
} from "@/lib/microcycles/db";
import { validateMicrocyclePutBody } from "@/lib/microcycles/validation";

const LOG_PREFIX = "[Trainer Microcycle API]";

interface RouteContext {
  params: Promise<{ clientId: string }>;
}

// GET — devuelve microciclo + sesiones de TODOS los programas activos
// del cliente (sin expandir descansos implícitos: la UI del entrenador
// trabaja con slots crudos).

export async function GET(_request: NextRequest, { params }: RouteContext) {
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

    const activePrograms = await loadAllActiveOwnedPrograms(
      supabase,
      clientId,
      session.trainer_id,
      correlationId
    );

    if (activePrograms.length === 0) {
      return NextResponse.json(
        { success: false, error: "Programa activo no encontrado" },
        { status: 404 }
      );
    }

    // Programa primario (más reciente): el microciclo se ancla aquí
    // (UNIQUE constraint en microcycles.client_program_id). Si más
    // adelante se quiere un microciclo "global" no anclado a un programa,
    // habrá que cambiar el schema.
    const primary = activePrograms[0]!;
    const programIds = activePrograms.map((p) => p.program_id);

    const microcycle = await loadMicrocycleWithSlots(
      supabase,
      primary.id,
      correlationId
    );

    const [
      { data: availableSessions, error: sessionsError },
      { data: programRows, error: programError },
    ] = await Promise.all([
      supabase
        .from("sessions")
        .select(
          "id, tenant_host, program_id, trainer_id, name, description, session_order, duration_minutes, session_type, intensity_level, equipment_needed, notes, metadata, created_at, updated_at"
        )
        .in("program_id", programIds)
        .order("session_order", { ascending: true }),
      supabase.from("programs").select("id, name").in("id", programIds),
    ]);

    // Conteo de session_exercises por sesión, en una sola query agregada,
    // para que el aside del editor muestre "X ejercicios" sin más fetches
    // del cliente.
    const sessionIds = (availableSessions ?? []).map((s) => s.id);
    const exerciseCounts = new Map<string, number>();

    if (sessionIds.length > 0) {
      const { data: rows, error: countError } = await supabase
        .from("session_exercises")
        .select("session_id")
        .in("session_id", sessionIds);

      if (countError) {
        console.warn(`${LOG_PREFIX} Failed to count session_exercises:`, {
          correlationId,
          error: countError.message,
        });
      } else {
        for (const row of rows ?? []) {
          exerciseCounts.set(
            row.session_id,
            (exerciseCounts.get(row.session_id) ?? 0) + 1
          );
        }
      }
    }

    if (sessionsError) {
      console.error(`${LOG_PREFIX} Error fetching available sessions:`, {
        correlationId,
        programIds,
        error: sessionsError.message,
      });

      return NextResponse.json(
        { success: false, error: "Error al obtener las sesiones del programa" },
        { status: 500 }
      );
    }

    if (programError) {
      console.warn(`${LOG_PREFIX} Failed to load programs info:`, {
        correlationId,
        programIds,
        error: programError.message,
      });
    }

    // El campo `program` (singular) sigue apuntando al primario para
    // compatibilidad con la UI actual; `programs` (plural) trae todos
    // por si más adelante el header quiere mostrar la lista completa.
    const programsByid = new Map(
      (programRows ?? []).map((p) => [p.id, { id: p.id, name: p.name }])
    );
    const primaryProgram = programsByid.get(primary.program_id) ?? null;
    const allPrograms = programIds
      .map((id) => programsByid.get(id))
      .filter((p): p is { id: string; name: string } => p !== undefined);

    const sessionsWithCount = (availableSessions ?? []).map((s) => ({
      ...s,
      exercise_count: exerciseCounts.get(s.id) ?? 0,
    }));

    return NextResponse.json({
      success: true,
      microcycle,
      available_sessions: sessionsWithCount,
      program: primaryProgram,
      programs: allPrograms,
      start_date: primary.start_date,
    });
  } catch (error) {
    console.error(`${LOG_PREFIX} GET unexpected error:`, {
      correlationId,
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// PUT — crea o reemplaza el microciclo del cliente. Estrategia: upsert
// del microcycle ancla al programa primario, luego DELETE+INSERT de los
// slots (ver §4.2 de bloque-1-spec.md). Las sesiones referenciadas
// pueden venir de cualquier programa activo del cliente, no solo del
// primario — un cliente con fuerza + cardio puede mezclar.

export async function PUT(request: NextRequest, { params }: RouteContext) {
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

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Body JSON inválido" },
        { status: 400 }
      );
    }

    const validation = validateMicrocyclePutBody(body);

    if (!validation.ok) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      );
    }

    const activePrograms = await loadAllActiveOwnedPrograms(
      supabase,
      clientId,
      session.trainer_id,
      correlationId
    );

    if (activePrograms.length === 0) {
      return NextResponse.json(
        { success: false, error: "Programa activo no encontrado" },
        { status: 404 }
      );
    }

    const primary = activePrograms[0]!;
    const programIds = activePrograms.map((p) => p.program_id);

    // Validación: cada session_id en el payload debe pertenecer a ALGÚN
    // programa activo del cliente (no necesariamente el primario).
    // Evita que un payload malicioso enlace sesiones de otro tenant.
    const sessionIdsInBody = validation.value.slots
      .map((s) => s.session_id)
      .filter((s): s is string => s !== null);

    if (sessionIdsInBody.length > 0) {
      const { data: foundSessions, error: foundError } = await supabase
        .from("sessions")
        .select("id")
        .in("id", sessionIdsInBody)
        .in("program_id", programIds);

      if (foundError) {
        console.error(`${LOG_PREFIX} Error validating session ownership:`, {
          correlationId,
          error: foundError.message,
        });

        return NextResponse.json(
          { success: false, error: "Error al validar las sesiones" },
          { status: 500 }
        );
      }

      const validIds = new Set((foundSessions ?? []).map((s) => s.id));
      const invalid = sessionIdsInBody.filter((id) => !validIds.has(id));

      if (invalid.length > 0) {
        return NextResponse.json(
          {
            success: false,
            error: `Algunas sesiones no pertenecen a los programas activos del cliente: ${invalid.join(", ")}`,
          },
          { status: 400 }
        );
      }
    }

    // Detect start_date change to trigger the future-rows cascade.
    // Compare against the existing microcycle's start_date (if any).
    // Also capture the OLD slot session_ids — needed to clear pins of
    // sessions that get removed from the microcycle in this same save.
    const existingMicrocycle = await loadMicrocycleWithSlots(
      supabase,
      primary.id,
      correlationId
    );
    const previousStartDate = existingMicrocycle?.start_date ?? null;
    const startDateChanged =
      previousStartDate !== null &&
      previousStartDate !== validation.value.start_date;
    const previousSlotSessionIds = (existingMicrocycle?.slots ?? [])
      .map((s) => s.session_id)
      .filter((id): id is string => typeof id === "string" && id.length > 0);

    const microcycleId = await upsertMicrocycle(
      supabase,
      primary,
      validation.value.duration_days,
      validation.value.start_date,
      correlationId
    );

    if (!microcycleId) {
      return NextResponse.json(
        { success: false, error: "Error al guardar el microciclo" },
        { status: 500 }
      );
    }

    const replaceError = await replaceSlots(
      supabase,
      microcycleId,
      validation.value.slots,
      correlationId
    );

    if (replaceError) {
      return NextResponse.json(
        { success: false, error: replaceError },
        { status: 500 }
      );
    }

    if (startDateChanged) {
      // Union of old + new slot session_ids. Old → para limpiar pins de
      // sesiones que el trainer acaba de remover del microciclo en este
      // mismo save (no quedan referenciadas pero igual tenían pins). New →
      // para limpiar pins alineados a la versión vieja del cronograma.
      // El cascade NO toca pins cuya session esté fuera de ambos sets
      // (esos vienen de otro microciclo activo del cliente — fuera de
      // scope).
      const newSlotSessionIds = validation.value.slots
        .map((s) => s.session_id)
        .filter((id): id is string => typeof id === "string" && id.length > 0);
      const scopedSessionIds = Array.from(
        new Set([...previousSlotSessionIds, ...newSlotSessionIds])
      );

      const cleanup = await cleanFuturePrescribedRowsForReset(
        supabase,
        clientId,
        validation.value.start_date,
        scopedSessionIds,
        correlationId
      );

      if (cleanup.error) {
        // No fatal — el microciclo ya está guardado. Logueamos y
        // seguimos. La UI puede mostrar un toast de advertencia.
        console.warn(`${LOG_PREFIX} start_date cascade had errors:`, {
          correlationId,
          clientId,
          microcycleId,
          error: cleanup.error,
        });
      }
    }

    const microcycle = await loadMicrocycleWithSlots(
      supabase,
      primary.id,
      correlationId
    );

    return NextResponse.json({ success: true, microcycle });
  } catch (error) {
    console.error(`${LOG_PREFIX} PUT unexpected error:`, {
      correlationId,
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
