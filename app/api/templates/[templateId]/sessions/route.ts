import { NextRequest, NextResponse } from "next/server";

import { getTrainerSession } from "@/lib/auth/session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";

// POST - Create a new session in a template
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ templateId: string }> }
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

    const { templateId } = await params;
    const body = await request.json();
    const { name, daysOfWeek } = body;

    console.log(
      "[Template Sessions API] Creating session for template:",
      templateId,
      body
    );

    // Verify that the template belongs to this trainer
    const { data: template, error: templateError } = await supabase
      .from("programs")
      .select("id, trainer_id, tenant_host, metadata")
      .eq("id", templateId)
      .eq("trainer_id", session.trainer_id)
      .eq("is_template", true)
      .single();

    if (templateError || !template) {
      console.error(
        "[Template Sessions API] Template not found or unauthorized:",
        templateError
      );

      return NextResponse.json(
        { success: false, error: "Plantilla no encontrada o no autorizada" },
        { status: 404 }
      );
    }

    // Determine session_type based on template category
    const templateCategory = template.metadata?.category;
    const sessionType = templateCategory === "cardio" ? "cardio" : "strength";

    // Get the current max session_order for this template
    const { data: existingSessions } = await supabase
      .from("sessions")
      .select("session_order")
      .eq("program_id", templateId)
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
        tenant_host: template.tenant_host,
        program_id: templateId,
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
      console.error(
        "[Template Sessions API] Error creating session:",
        sessionError
      );

      return NextResponse.json(
        { success: false, error: "Error al crear sesión" },
        { status: 500 }
      );
    }

    console.log("[Template Sessions API] Session created:", newSession.id);

    return NextResponse.json({
      success: true,
      session: newSession,
    });
  } catch (error) {
    console.error("[Template Sessions API] Unexpected error:", error);

    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// PUT - Update a session in template
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ templateId: string }> }
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

    const { templateId } = await params;
    const body = await request.json();
    const { sessionId, name, daysOfWeek } = body;

    console.log(
      "[Template Sessions API] Updating session:",
      sessionId,
      "in template:",
      templateId
    );

    // Verify that the session belongs to this trainer's template
    const { data: sessionData, error: sessionError } = await supabase
      .from("sessions")
      .select("id, program_id, trainer_id")
      .eq("id", sessionId)
      .eq("program_id", templateId)
      .eq("trainer_id", session.trainer_id)
      .single();

    if (sessionError || !sessionData) {
      console.error(
        "[Template Sessions API] Session not found or unauthorized:",
        sessionError
      );

      return NextResponse.json(
        { success: false, error: "Sesión no encontrada o no autorizada" },
        { status: 404 }
      );
    }

    // Update session
    const { data: updatedSession, error: updateError } = await supabase
      .from("sessions")
      .update({
        name,
        metadata: {
          days_of_week: daysOfWeek,
        },
      })
      .eq("id", sessionId)
      .select()
      .single();

    if (updateError) {
      console.error(
        "[Template Sessions API] Error updating session:",
        updateError
      );

      return NextResponse.json(
        { success: false, error: "Error al actualizar sesión" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      session: updatedSession,
    });
  } catch (error) {
    console.error("[Template Sessions API] Unexpected error:", error);

    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// DELETE - Remove session from template
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ templateId: string }> }
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

    const { templateId } = await params;
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: "Session ID is required" },
        { status: 400 }
      );
    }

    console.log(
      "[Template Sessions API] Deleting session:",
      sessionId,
      "from template:",
      templateId
    );

    // Verify that the session belongs to this trainer's template
    const { data: sessionData } = await supabase
      .from("sessions")
      .select("id, program_id, trainer_id")
      .eq("id", sessionId)
      .eq("program_id", templateId)
      .eq("trainer_id", session.trainer_id)
      .single();

    if (!sessionData) {
      return NextResponse.json(
        { success: false, error: "Sesión no encontrada o no autorizada" },
        { status: 404 }
      );
    }

    // Delete session (cascade will delete exercises)
    const { error: deleteError } = await supabase
      .from("sessions")
      .delete()
      .eq("id", sessionId);

    if (deleteError) {
      console.error(
        "[Template Sessions API] Error deleting session:",
        deleteError
      );

      return NextResponse.json(
        { success: false, error: "Error al eliminar sesión" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Sesión eliminada exitosamente",
    });
  } catch (error) {
    console.error("[Template Sessions API] Unexpected error:", error);

    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
