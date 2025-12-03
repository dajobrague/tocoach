import { NextRequest, NextResponse } from "next/server";

import { getTrainerSession } from "@/lib/auth/session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";

// POST - Save an existing program as a template
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ programId: string }> }
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

    const { programId } = await params;
    const body = await request.json();
    const { templateName } = body;

    console.log(
      "[Save as Template API] Saving program as template:",
      programId,
      templateName
    );

    // Fetch the source program
    const { data: sourceProgram, error: programError } = await supabase
      .from("programs")
      .select("*")
      .eq("id", programId)
      .eq("trainer_id", session.trainer_id)
      .eq("is_template", false)
      .single();

    if (programError || !sourceProgram) {
      console.error("[Save as Template API] Program not found:", programError);

      return NextResponse.json(
        { success: false, error: "Programa no encontrado" },
        { status: 404 }
      );
    }

    // Get tenant_host for the trainer
    const { data: tenant } = await supabase
      .from("tenants")
      .select("host")
      .eq("trainer_id", session.trainer_id)
      .single();

    if (!tenant) {
      return NextResponse.json(
        { success: false, error: "Tenant no encontrado" },
        { status: 404 }
      );
    }

    // Create the template
    const { data: template, error: templateError } = await supabase
      .from("programs")
      .insert({
        tenant_host: tenant.host,
        trainer_id: session.trainer_id,
        name: templateName,
        description: sourceProgram.description,
        is_template: true,
        is_published: false,
        metadata: sourceProgram.metadata,
      })
      .select()
      .single();

    if (templateError || !template) {
      console.error(
        "[Save as Template API] Error creating template:",
        templateError
      );

      return NextResponse.json(
        { success: false, error: "Error al crear plantilla" },
        { status: 500 }
      );
    }

    // Clone sessions and exercises from the source program
    const { data: sourceSessions } = await supabase
      .from("sessions")
      .select("*")
      .eq("program_id", programId)
      .order("session_order", { ascending: true });

    if (sourceSessions && sourceSessions.length > 0) {
      for (const sourceSession of sourceSessions) {
        // Create new session
        const { data: newSession, error: sessionError } = await supabase
          .from("sessions")
          .insert({
            tenant_host: tenant.host,
            program_id: template.id,
            trainer_id: session.trainer_id,
            name: sourceSession.name,
            description: sourceSession.description,
            session_order: sourceSession.session_order,
            duration_minutes: sourceSession.duration_minutes,
            session_type: sourceSession.session_type,
            intensity_level: sourceSession.intensity_level,
            equipment_needed: sourceSession.equipment_needed,
            notes: sourceSession.notes,
            metadata: sourceSession.metadata,
          })
          .select()
          .single();

        if (sessionError || !newSession) {
          console.error(
            "[Save as Template API] Error cloning session:",
            sessionError
          );
          continue;
        }

        // Clone exercises for this session
        const { data: sourceExercises } = await supabase
          .from("session_exercises")
          .select("*")
          .eq("session_id", sourceSession.id)
          .order("exercise_order", { ascending: true });

        if (sourceExercises && sourceExercises.length > 0) {
          const exercisesToInsert = sourceExercises.map((ex) => ({
            tenant_host: tenant.host,
            session_id: newSession.id,
            exercise_id: ex.exercise_id,
            exercise_order: ex.exercise_order,
            sets: ex.sets,
            reps: ex.reps,
            duration_seconds: ex.duration_seconds,
            rest_seconds: ex.rest_seconds,
            weight_kg: ex.weight_kg,
            distance_meters: ex.distance_meters,
            notes: ex.notes,
            metadata: ex.metadata,
          }));

          await supabase.from("session_exercises").insert(exercisesToInsert);
        }
      }
    }

    console.log(
      "[Save as Template API] Template created successfully:",
      template.id
    );

    return NextResponse.json({
      success: true,
      templateId: template.id,
      message: "Plantilla creada exitosamente",
    });
  } catch (error) {
    console.error("[Save as Template API] Unexpected error:", error);

    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
