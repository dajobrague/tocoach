/* eslint-disable no-console */
import { NextRequest, NextResponse } from "next/server";

import { getTrainerSession } from "@/lib/auth/session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";

// POST - Create a new session in a program
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string; programId: string }> }
) {
  const supabase = createSupabaseClient();

  try {
    // Authenticate trainer
    const session = await getTrainerSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 401 }
      );
    }

    const { clientId: _clientId, programId } = await params;
    const body = await request.json();
    const { name, daysOfWeek } = body;

    console.log(
      "[Sessions API] Creating session for program:",
      programId,
      body
    );

    // Verify that the program belongs to this trainer and get its category
    const { data: program, error: programError } = await supabase
      .from("programs")
      .select("id, trainer_id, tenant_host, metadata")
      .eq("id", programId)
      .eq("trainer_id", session.trainer_id)
      .single();

    if (programError || !program) {
      console.error(
        "[Sessions API] Program not found or unauthorized:",
        programError
      );

      return NextResponse.json(
        { success: false, error: "Programa no encontrado o no autorizado" },
        { status: 404 }
      );
    }

    // Determine session_type based on program category
    const programCategory = program.metadata?.category;
    const sessionType = programCategory === "cardio" ? "cardio" : "strength";

    // Get the current max session_order for this program
    const { data: existingSessions } = await supabase
      .from("sessions")
      .select("session_order")
      .eq("program_id", programId)
      .order("session_order", { ascending: false })
      .limit(1);

    const nextOrder =
      existingSessions && existingSessions.length > 0 && existingSessions[0]
        ? (existingSessions[0].session_order || 0) + 1
        : 1;

    // Create the session
    const { data: newSession, error: sessionError } = await supabase
      .from("sessions")
      .insert({
        tenant_host: program.tenant_host,
        program_id: programId,
        trainer_id: session.trainer_id,
        name,
        session_order: nextOrder,
        session_type: sessionType,
        metadata: {
          days_of_week: daysOfWeek,
        },
      })
      .select()
      .single();

    if (sessionError || !newSession) {
      console.error("[Sessions API] Error creating session:", sessionError);

      return NextResponse.json(
        { success: false, error: "Error al crear sesión" },
        { status: 500 }
      );
    }

    console.log("[Sessions API] Session created:", newSession.id);

    return NextResponse.json({
      success: true,
      session: newSession,
    });
  } catch (error) {
    console.error("[Sessions API] Unexpected error:", error);

    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// PUT - Update a session
export async function PUT(
  request: NextRequest,
  {
    params: _params,
  }: { params: Promise<{ clientId: string; programId: string }> }
) {
  const supabase = createSupabaseClient();

  try {
    // Authenticate trainer
    const session = await getTrainerSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: "Session ID requerido" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { name, daysOfWeek } = body;

    console.log("[Sessions API] Updating session:", sessionId, body);

    // Update the session
    const { data: updatedSession, error: sessionError } = await supabase
      .from("sessions")
      .update({
        name,
        metadata: {
          days_of_week: daysOfWeek,
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", sessionId)
      .eq("trainer_id", session.trainer_id)
      .select()
      .single();

    if (sessionError || !updatedSession) {
      console.error("[Sessions API] Error updating session:", sessionError);

      return NextResponse.json(
        { success: false, error: "Error al actualizar sesión" },
        { status: 500 }
      );
    }

    console.log("[Sessions API] Session updated:", updatedSession.id);

    return NextResponse.json({
      success: true,
      session: updatedSession,
    });
  } catch (error) {
    console.error("[Sessions API] Unexpected error:", error);

    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a session
export async function DELETE(
  request: NextRequest,
  {
    params: _params,
  }: { params: Promise<{ clientId: string; programId: string }> }
) {
  const supabase = createSupabaseClient();

  try {
    // Authenticate trainer
    const session = await getTrainerSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: "Session ID requerido" },
        { status: 400 }
      );
    }

    console.log("[Sessions API] Deleting session:", sessionId);

    // Delete the session (cascade will handle session_exercises)
    const { error: sessionError } = await supabase
      .from("sessions")
      .delete()
      .eq("id", sessionId)
      .eq("trainer_id", session.trainer_id);

    if (sessionError) {
      console.error("[Sessions API] Error deleting session:", sessionError);

      return NextResponse.json(
        { success: false, error: "Error al eliminar sesión" },
        { status: 500 }
      );
    }

    console.log("[Sessions API] Session deleted:", sessionId);

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("[Sessions API] Unexpected error:", error);

    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// PATCH - Reorder sessions in a program
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string; programId: string }> }
) {
  const supabase = createSupabaseClient();

  try {
    const session = await getTrainerSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 401 }
      );
    }

    const { programId } = await params;
    const body = await request.json();
    const { reorder } = body;

    if (!reorder || !Array.isArray(reorder)) {
      return NextResponse.json(
        { success: false, error: "Se requiere un array de reorder" },
        { status: 400 }
      );
    }

    // Verify program belongs to this trainer
    const { data: program, error: programError } = await supabase
      .from("programs")
      .select("id, trainer_id")
      .eq("id", programId)
      .eq("trainer_id", session.trainer_id)
      .eq("is_template", false)
      .single();

    if (programError || !program) {
      return NextResponse.json(
        { success: false, error: "Programa no encontrado o no autorizado" },
        { status: 404 }
      );
    }

    // Batch update session_order for each session
    const updatePromises = reorder.map(
      (item: { id: string; session_order: number }) =>
        supabase
          .from("sessions")
          .update({ session_order: item.session_order })
          .eq("id", item.id)
          .eq("program_id", programId)
          .eq("trainer_id", session.trainer_id)
    );

    const results = await Promise.all(updatePromises);
    const hasError = results.some((r) => r.error);

    if (hasError) {
      console.error(
        "[Sessions API] Error reordering sessions:",
        results.filter((r) => r.error).map((r) => r.error)
      );

      return NextResponse.json(
        { success: false, error: "Error al reordenar sesiones" },
        { status: 500 }
      );
    }

    console.log("[Sessions API] Sessions reordered successfully");

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Sessions API] Unexpected error:", error);

    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
