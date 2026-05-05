// GET / PUT /api/clients/[clientId]/microcycle
// Endpoints trainer-side para configurar el microciclo (plan semanal) de
// un cliente sobre su programa activo. Replica el patrón de los otros
// endpoints trainer-on-client (ej. /api/clients/[clientId]/programs):
// auth con getTrainerSession + check de ownership implícito vía
// client_programs.trainer_id = session.trainer_id.

/* eslint-disable no-console */
import { NextRequest, NextResponse } from "next/server";

import { getTrainerSession } from "@/lib/auth/session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";
import {
  loadActiveOwnedProgram,
  loadMicrocycleWithSlots,
  replaceSlots,
  upsertMicrocycle,
} from "@/lib/microcycles/db";
import { validateMicrocyclePutBody } from "@/lib/microcycles/validation";

const LOG_PREFIX = "[Trainer Microcycle API]";

interface RouteContext {
  params: Promise<{ clientId: string }>;
}

// GET — devuelve microciclo + sesiones del programa activo (sin expandir
// descansos implícitos: la UI del entrenador trabaja con slots crudos).

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

    const ownedProgram = await loadActiveOwnedProgram(
      supabase,
      clientId,
      session.trainer_id,
      correlationId
    );

    if (!ownedProgram) {
      return NextResponse.json(
        { success: false, error: "Programa activo no encontrado" },
        { status: 404 }
      );
    }

    const microcycle = await loadMicrocycleWithSlots(
      supabase,
      ownedProgram.id,
      correlationId
    );

    const { data: availableSessions, error: sessionsError } = await supabase
      .from("sessions")
      .select(
        "id, tenant_host, program_id, trainer_id, name, description, session_order, duration_minutes, session_type, intensity_level, equipment_needed, notes, metadata, created_at, updated_at"
      )
      .eq("program_id", ownedProgram.program_id)
      .order("session_order", { ascending: true });

    if (sessionsError) {
      console.error(`${LOG_PREFIX} Error fetching available sessions:`, {
        correlationId,
        programId: ownedProgram.program_id,
        error: sessionsError.message,
      });

      return NextResponse.json(
        { success: false, error: "Error al obtener las sesiones del programa" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      microcycle,
      available_sessions: availableSessions ?? [],
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

// PUT — crea o reemplaza el microciclo del cliente. Estrategia: upsert del
// microcycle por client_program_id, luego DELETE+INSERT de los slots
// (más simple que diff incremental y suficiente para la frecuencia
// esperada de cambios — ver §4.2 de bloque-1-spec.md).

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

    const ownedProgram = await loadActiveOwnedProgram(
      supabase,
      clientId,
      session.trainer_id,
      correlationId
    );

    if (!ownedProgram) {
      return NextResponse.json(
        { success: false, error: "Programa activo no encontrado" },
        { status: 404 }
      );
    }

    // Verifica que las sesiones referenciadas existen y pertenecen a este
    // mismo programa. Evita que un payload malicioso enlace sesiones de
    // otro tenant o de otro programa.
    const sessionIdsInBody = validation.value.slots
      .map((s) => s.session_id)
      .filter((s): s is string => s !== null);

    if (sessionIdsInBody.length > 0) {
      const { data: foundSessions, error: foundError } = await supabase
        .from("sessions")
        .select("id")
        .in("id", sessionIdsInBody)
        .eq("program_id", ownedProgram.program_id);

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
            error: `Algunas sesiones no pertenecen al programa activo: ${invalid.join(", ")}`,
          },
          { status: 400 }
        );
      }
    }

    const microcycleId = await upsertMicrocycle(
      supabase,
      ownedProgram,
      validation.value.duration_days,
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

    const microcycle = await loadMicrocycleWithSlots(
      supabase,
      ownedProgram.id,
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
