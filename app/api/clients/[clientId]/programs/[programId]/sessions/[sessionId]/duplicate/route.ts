/* eslint-disable no-console */
// POST /api/clients/[clientId]/programs/[programId]/sessions/[sessionId]/duplicate
// Duplicar una sesión con todos sus ejercicios (Fase 2 — llamada 15 Jul):
// "Empujes A" → "Empujes B" sin reconstruir nada. Clon profundo en el
// servidor (sets, reps, pesos, descansos, tempo, sistema, custom_name) y la
// copia queda JUSTO DEBAJO de la original (las siguientes se corren +1).
// Body: { name? } — el nombre elegido en el modal; default "X (copia)".

import { NextRequest, NextResponse } from "next/server";

import { getTrainerSession } from "@/lib/auth/session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";
import {
  cloneSessionExerciseRows,
  duplicateName,
} from "@/lib/training/duplicate-session";

export async function POST(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ clientId: string; programId: string; sessionId: string }>;
  }
) {
  const supabase = createSupabaseClient();
  const correlationId = `req-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  try {
    const session = await getTrainerSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 401 }
      );
    }

    const { programId, sessionId } = await params;
    const body = await request.json().catch(() => ({}));
    const requestedName =
      typeof body?.name === "string" ? body.name.trim() : "";

    // Programa del trainer (autorización + tenant).
    const { data: program, error: programError } = await supabase
      .from("programs")
      .select("id, trainer_id, tenant_host")
      .eq("id", programId)
      .eq("trainer_id", session.trainer_id)
      .single();

    if (programError || !program) {
      return NextResponse.json(
        { success: false, error: "Programa no encontrado o no autorizado" },
        { status: 404 }
      );
    }

    // Sesión origen (debe pertenecer al programa).
    const { data: source, error: sourceError } = await supabase
      .from("sessions")
      .select("*")
      .eq("id", sessionId)
      .eq("program_id", programId)
      .single();

    if (sourceError || !source) {
      return NextResponse.json(
        { success: false, error: "Sesión no encontrada" },
        { status: 404 }
      );
    }

    const sourceOrder = source.session_order ?? 0;

    // Hacer hueco: las sesiones después de la original se corren +1 para que
    // la copia quede justo debajo. Descendente para no chocar órdenes.
    const { data: toShift, error: toShiftError } = await supabase
      .from("sessions")
      .select("id, session_order")
      .eq("program_id", programId)
      .gt("session_order", sourceOrder)
      .order("session_order", { ascending: false });

    // Un fallo aquí NO puede tratarse como "no hay nada que correr": el clon
    // se insertaría con un orden ya ocupado.
    if (toShiftError) {
      console.error("[Duplicate Session API] shift fetch failed:", {
        correlationId,
        error: toShiftError.message,
      });

      return NextResponse.json(
        { success: false, error: "Error al reordenar sesiones" },
        { status: 500 }
      );
    }

    for (const row of toShift ?? []) {
      const { error: shiftError } = await supabase
        .from("sessions")
        .update({ session_order: (row.session_order ?? 0) + 1 })
        .eq("id", row.id);

      if (shiftError) {
        console.error("[Duplicate Session API] shift failed:", {
          correlationId,
          error: shiftError.message,
        });

        return NextResponse.json(
          { success: false, error: "Error al reordenar sesiones" },
          { status: 500 }
        );
      }
    }

    // Insertar el clon debajo de la original.
    const { data: clone, error: cloneError } = await supabase
      .from("sessions")
      .insert({
        tenant_host: program.tenant_host,
        program_id: programId,
        trainer_id: session.trainer_id,
        name:
          requestedName.length > 0 ? requestedName : duplicateName(source.name),
        description: source.description,
        session_order: sourceOrder + 1,
        duration_minutes: source.duration_minutes,
        session_type: source.session_type,
        intensity_level: source.intensity_level,
        equipment_needed: source.equipment_needed,
        notes: source.notes,
        metadata: source.metadata,
      })
      .select()
      .single();

    if (cloneError || !clone) {
      console.error("[Duplicate Session API] clone insert failed:", {
        correlationId,
        error: cloneError?.message,
      });

      return NextResponse.json(
        { success: false, error: "Error al duplicar la sesión" },
        { status: 500 }
      );
    }

    // Clonar los ejercicios en bloque.
    const { data: exercises, error: exercisesError } = await supabase
      .from("session_exercises")
      .select("*")
      .eq("session_id", sessionId)
      .order("exercise_order", { ascending: true });

    if (exercisesError) {
      console.error("[Duplicate Session API] exercises fetch failed:", {
        correlationId,
        error: exercisesError.message,
      });
      await supabase.from("sessions").delete().eq("id", clone.id);

      return NextResponse.json(
        { success: false, error: "Error al leer los ejercicios" },
        { status: 500 }
      );
    }

    if (exercises && exercises.length > 0) {
      const { error: insertError } = await supabase
        .from("session_exercises")
        .insert(
          cloneSessionExerciseRows(exercises, {
            tenantHost: program.tenant_host,
            sessionId: clone.id,
          })
        );

      if (insertError) {
        // Sin transacción: revertir el clon vacío para no dejar una sesión
        // a medias que el trainer confunda con la copia completa.
        console.error("[Duplicate Session API] exercises insert failed:", {
          correlationId,
          error: insertError.message,
        });
        await supabase.from("sessions").delete().eq("id", clone.id);

        return NextResponse.json(
          { success: false, error: "Error al duplicar los ejercicios" },
          { status: 500 }
        );
      }
    }

    console.log("[Duplicate Session API] duplicated:", {
      correlationId,
      source: sessionId,
      clone: clone.id,
      exercises: exercises?.length ?? 0,
    });

    return NextResponse.json({
      success: true,
      session: clone,
      exercisesCloned: exercises?.length ?? 0,
    });
  } catch (error) {
    console.error("[Duplicate Session API] Unexpected error:", {
      correlationId,
      error,
    });

    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
