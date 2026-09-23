/* eslint-disable no-console */
// POST .../sessions/[sessionId]/exercises/duplicate — { sessionExerciseId }
// Duplica UN ejercicio dentro de la sesión (Fase 2 — llamada 15 Jul): la
// copia queda justo debajo del original con la prescripción completa
// (sets, reps, peso, descansos, tempo, metadata, custom_name). Clon en el
// servidor: re-postear el form del cliente perdería campos que el form no
// expone (weight_kg, cardio) y arriesga el fallback por nombre de librería.
//
// { targetSessionId, move } (JC, 22 sep: "llevarme ejercicios de Empuje B a
// la A"): la copia va AL FINAL de otra sesión del mismo programa; con
// move=true se borra el original. Mover = clonar + borrar, no cambiar el
// session_id: los logs del cliente apuntan al slot (session_exercise_id) y
// deben quedarse fuera del día nuevo — el FK los deja en NULL, igual que
// "Eliminar".

import { NextRequest, NextResponse } from "next/server";

import { getTrainerSession } from "@/lib/auth/session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";
import {
  cloneSessionExerciseRows,
  type SessionExerciseRow,
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
    const sessionExerciseId =
      typeof body?.sessionExerciseId === "string" ? body.sessionExerciseId : "";

    const targetSessionId =
      typeof body?.targetSessionId === "string" &&
      body.targetSessionId !== sessionId
        ? body.targetSessionId
        : null;
    const move = targetSessionId !== null && body?.move === true;

    if (sessionExerciseId.length === 0) {
      return NextResponse.json(
        { success: false, error: "sessionExerciseId es requerido" },
        { status: 400 }
      );
    }

    // Autorización: el programa es del trainer y la sesión es del programa.
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

    const { data: sessionRow, error: sessionRowError } = await supabase
      .from("sessions")
      .select("id")
      .eq("id", sessionId)
      .eq("program_id", programId)
      .single();

    if (sessionRowError || !sessionRow) {
      return NextResponse.json(
        { success: false, error: "Sesión no encontrada" },
        { status: 404 }
      );
    }

    const { data: source, error: sourceError } = await supabase
      .from("session_exercises")
      .select("*")
      .eq("id", sessionExerciseId)
      .eq("session_id", sessionId)
      .single();

    if (sourceError || !source) {
      return NextResponse.json(
        { success: false, error: "Ejercicio no encontrado" },
        { status: 404 }
      );
    }

    if (targetSessionId !== null) {
      return copyToSession({
        supabase,
        correlationId,
        source,
        programId,
        targetSessionId,
        tenantHost: program.tenant_host,
        move,
      });
    }

    const sourceOrder = source.exercise_order ?? 0;

    // Hacer hueco debajo del original (descendente para no chocar órdenes).
    const { data: toShift, error: toShiftError } = await supabase
      .from("session_exercises")
      .select("id, exercise_order")
      .eq("session_id", sessionId)
      .gt("exercise_order", sourceOrder)
      .order("exercise_order", { ascending: false });

    // Un fallo aquí NO puede tratarse como "no hay nada que correr": el clon
    // se insertaría con un orden ya ocupado.
    if (toShiftError) {
      console.error("[Duplicate Exercise API] shift fetch failed:", {
        correlationId,
        error: toShiftError.message,
      });

      return NextResponse.json(
        { success: false, error: "Error al reordenar ejercicios" },
        { status: 500 }
      );
    }

    for (const row of toShift ?? []) {
      const { error: shiftError } = await supabase
        .from("session_exercises")
        .update({ exercise_order: (row.exercise_order ?? 0) + 1 })
        .eq("id", row.id);

      if (shiftError) {
        console.error("[Duplicate Exercise API] shift failed:", {
          correlationId,
          error: shiftError.message,
        });

        return NextResponse.json(
          { success: false, error: "Error al reordenar ejercicios" },
          { status: 500 }
        );
      }
    }

    const [cloneRow] = cloneSessionExerciseRows([source], {
      tenantHost: program.tenant_host,
      sessionId,
    });
    const { data: clone, error: cloneError } = await supabase
      .from("session_exercises")
      .insert({ ...cloneRow, exercise_order: sourceOrder + 1 })
      .select()
      .single();

    if (cloneError || !clone) {
      console.error("[Duplicate Exercise API] insert failed:", {
        correlationId,
        error: cloneError?.message,
      });

      return NextResponse.json(
        { success: false, error: "Error al duplicar el ejercicio" },
        { status: 500 }
      );
    }

    console.log("[Duplicate Exercise API] duplicated:", {
      correlationId,
      source: sessionExerciseId,
      clone: clone.id,
    });

    return NextResponse.json({ success: true, exercise: clone });
  } catch (error) {
    console.error("[Duplicate Exercise API] Unexpected error:", {
      correlationId,
      error,
    });

    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

/** Copia (o mueve) el ejercicio al final de otra sesión del mismo programa. */
async function copyToSession({
  supabase,
  correlationId,
  source,
  programId,
  targetSessionId,
  tenantHost,
  move,
}: {
  supabase: ReturnType<typeof createSupabaseClient>;
  correlationId: string;
  source: SessionExerciseRow & { id: string };
  programId: string;
  targetSessionId: string;
  tenantHost: string;
  move: boolean;
}) {
  const { data: target, error: targetError } = await supabase
    .from("sessions")
    .select("id")
    .eq("id", targetSessionId)
    .eq("program_id", programId)
    .single();

  if (targetError || !target) {
    return NextResponse.json(
      { success: false, error: "Sesión destino no encontrada" },
      { status: 404 }
    );
  }

  const { data: last, error: lastError } = await supabase
    .from("session_exercises")
    .select("exercise_order")
    .eq("session_id", targetSessionId)
    .order("exercise_order", { ascending: false })
    .limit(1);

  if (lastError) {
    console.error("[Duplicate Exercise API] target order fetch failed:", {
      correlationId,
      error: lastError.message,
    });

    return NextResponse.json(
      { success: false, error: "Error al copiar el ejercicio" },
      { status: 500 }
    );
  }

  const [cloneRow] = cloneSessionExerciseRows([source], {
    tenantHost,
    sessionId: targetSessionId,
  });
  const { data: clone, error: cloneError } = await supabase
    .from("session_exercises")
    .insert({
      ...cloneRow,
      exercise_order: (last?.[0]?.exercise_order ?? 0) + 1,
    })
    .select()
    .single();

  if (cloneError || !clone) {
    console.error("[Duplicate Exercise API] target insert failed:", {
      correlationId,
      error: cloneError?.message,
    });

    return NextResponse.json(
      { success: false, error: "Error al copiar el ejercicio" },
      { status: 500 }
    );
  }

  if (move) {
    const { error: deleteError } = await supabase
      .from("session_exercises")
      .delete()
      .eq("id", source.id);

    // La copia ya existe: avisar en vez de fallar en silencio (quedaría
    // duplicado en ambas sesiones).
    if (deleteError) {
      console.error("[Duplicate Exercise API] move delete failed:", {
        correlationId,
        error: deleteError.message,
      });

      return NextResponse.json(
        {
          success: false,
          error:
            "Se copió a la otra sesión pero no se pudo quitar de esta. Elimínalo a mano.",
        },
        { status: 500 }
      );
    }
  }

  console.log("[Duplicate Exercise API] copied to session:", {
    correlationId,
    source: source.id,
    clone: clone.id,
    targetSessionId,
    move,
  });

  return NextResponse.json({ success: true, exercise: clone });
}
