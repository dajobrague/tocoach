import { NextRequest, NextResponse } from "next/server";

import { getTrainerSession } from "@/lib/auth/session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";
import { INCREASE_WEIGHT_KEY } from "@/lib/training/increase-weight";

const YMD = /^\d{4}-\d{2}-\d{2}$/;

/**
 * PUT /api/clients/[clientId]/session-exercises/[sessionExerciseId]/increase-weight
 * Body: { after: "YYYY-MM-DD" | null }
 *
 * Marca (o quita) "subir peso en la próxima sesión" en un slot del programa
 * del cliente. `after` = el día que el entrenador está revisando; el cliente
 * ve el aviso en sus sesiones posteriores (ver lib/training/increase-weight).
 */
export async function PUT(
  request: NextRequest,
  {
    params,
  }: { params: Promise<{ clientId: string; sessionExerciseId: string }> }
) {
  const session = await getTrainerSession();

  if (!session) {
    return NextResponse.json(
      { success: false, error: "No autorizado" },
      { status: 401 }
    );
  }

  const { clientId, sessionExerciseId } = await params;
  const body = await request.json().catch(() => null);
  const after: unknown = body?.after;

  if (after !== null && !(typeof after === "string" && YMD.test(after))) {
    return NextResponse.json(
      { success: false, error: "Fecha inválida" },
      { status: 400 }
    );
  }

  const supabase = createSupabaseClient();

  // Ownership: slot → sesión del trainer → programa asignado a ESTE cliente.
  const { data: slot } = await supabase
    .from("session_exercises")
    .select("id, metadata, session:sessions!inner(program_id, trainer_id)")
    .eq("id", sessionExerciseId)
    .maybeSingle();
  const owner = slot?.session as unknown as {
    program_id: string;
    trainer_id: string;
  } | null;

  if (!slot || !owner || owner.trainer_id !== session.trainer_id) {
    return NextResponse.json(
      { success: false, error: "Ejercicio no encontrado" },
      { status: 404 }
    );
  }

  const { data: clientProgram } = await supabase
    .from("client_programs")
    .select("id")
    .eq("program_id", owner.program_id)
    .eq("client_id", clientId)
    .eq("trainer_id", session.trainer_id)
    .maybeSingle();

  if (!clientProgram) {
    return NextResponse.json(
      { success: false, error: "Ejercicio no encontrado" },
      { status: 404 }
    );
  }

  const { [INCREASE_WEIGHT_KEY]: _previous, ...rest } = (slot.metadata ??
    {}) as Record<string, unknown>;
  const metadata = after ? { ...rest, [INCREASE_WEIGHT_KEY]: after } : rest;

  const { error } = await supabase
    .from("session_exercises")
    .update({ metadata })
    .eq("id", sessionExerciseId);

  if (error) {
    console.error("[Increase Weight API] Update failed:", error);

    return NextResponse.json(
      { success: false, error: "Error al guardar" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, after });
}
