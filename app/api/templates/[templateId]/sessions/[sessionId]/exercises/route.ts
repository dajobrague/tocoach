import { NextRequest, NextResponse } from "next/server";

import { getTrainerSession } from "@/lib/auth/session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";

// POST - Add a new exercise to a template session
export async function POST(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ templateId: string; sessionId: string }>;
  }
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

    const { templateId, sessionId } = await params;
    const body = await request.json();
    const {
      name,
      exerciseId, // If provided, use existing exercise from library
      sets,
      reps,
      tempo,
      rest,
      trainingSystem,
      videoUrl,
      // Cardio-specific fields
      duration,
      distance,
      intensity,
      minHeartRate,
      maxHeartRate,
      type,
      notes,
    } = body;

    console.log(
      "[Template Exercises API] Creating exercise for session:",
      sessionId,
      body
    );

    // Verify that the session belongs to this trainer's template
    const { data: sessionData, error: sessionError } = await supabase
      .from("sessions")
      .select("id, trainer_id, tenant_host, session_type, program_id")
      .eq("id", sessionId)
      .eq("program_id", templateId)
      .eq("trainer_id", session.trainer_id)
      .single();

    if (sessionError || !sessionData) {
      console.error(
        "[Template Exercises API] Session not found or unauthorized:",
        sessionError
      );

      return NextResponse.json(
        { success: false, error: "Sesión no encontrada o no autorizada" },
        { status: 404 }
      );
    }

    // First, create or find the exercise in the exercise library
    let finalExerciseId: string;

    // If exerciseId is provided, use it (selected from library)
    if (exerciseId) {
      finalExerciseId = exerciseId;
      console.log(
        "[Template Exercises API] Using exercise from library:",
        finalExerciseId
      );
    } else {
      // Check if an exercise with this name already exists for this trainer
      const { data: existingExercise } = await supabase
        .from("exercises")
        .select("id")
        .eq("name", name)
        .eq("trainer_id", session.trainer_id)
        .maybeSingle();

      if (existingExercise) {
        finalExerciseId = existingExercise.id;
        console.log(
          "[Template Exercises API] Using existing exercise:",
          finalExerciseId
        );
      } else {
        // Create new exercise
        const exerciseCategory =
          sessionData.session_type === "cardio" ? "cardio" : "strength";

        const { data: newExercise, error: exerciseError } = await supabase
          .from("exercises")
          .insert({
            tenant_host: sessionData.tenant_host,
            trainer_id: session.trainer_id,
            name,
            category: exerciseCategory,
            video_url: videoUrl || null,
            is_public: false,
            metadata: {},
          })
          .select()
          .single();

        if (exerciseError || !newExercise) {
          console.error(
            "[Template Exercises API] Error creating exercise:",
            exerciseError
          );

          return NextResponse.json(
            { success: false, error: "Error al crear ejercicio" },
            { status: 500 }
          );
        }

        finalExerciseId = newExercise.id;
        console.log(
          "[Template Exercises API] Created new exercise:",
          finalExerciseId
        );
      }
    }

    // Get the current max exercise_order for this session
    const { data: existingExercises } = await supabase
      .from("session_exercises")
      .select("exercise_order")
      .eq("session_id", sessionId)
      .order("exercise_order", { ascending: false })
      .limit(1);

    const nextOrder =
      existingExercises && existingExercises.length > 0 && existingExercises[0]
        ? existingExercises[0].exercise_order + 1
        : 1;

    // Build metadata object
    const metadata: any = {};

    if (sessionData.session_type === "cardio") {
      // Cardio-specific metadata
      if (type) metadata.cardio_type = type;
      if (intensity) metadata.intensity = intensity;
      if (minHeartRate && maxHeartRate) {
        metadata.heart_rate_zone = {
          min: parseInt(minHeartRate),
          max: parseInt(maxHeartRate),
        };
      }
    } else {
      // Strength-specific metadata
      if (tempo) metadata.tempo = tempo;
      if (trainingSystem) metadata.training_system = trainingSystem;
      if (rest) metadata.rest_description = rest;
    }

    if (notes) metadata.notes = notes;

    // Add the exercise to the session
    const { data: sessionExercise, error: linkError } = await supabase
      .from("session_exercises")
      .insert({
        tenant_host: sessionData.tenant_host,
        session_id: sessionId,
        exercise_id: finalExerciseId,
        exercise_order: nextOrder,
        sets: sets ? parseInt(sets) : null,
        reps: reps || null,
        duration_seconds: duration ? parseInt(duration) * 60 : null, // Convert minutes to seconds
        distance_meters: distance ? parseFloat(distance) * 1000 : null, // Convert km to meters
        rest_seconds: rest && !isNaN(parseInt(rest)) ? parseInt(rest) : null,
        metadata,
      })
      .select("*, exercises(*)")
      .single();

    if (linkError || !sessionExercise) {
      console.error(
        "[Template Exercises API] Error adding exercise to session:",
        linkError
      );

      return NextResponse.json(
        { success: false, error: "Error al añadir ejercicio a la sesión" },
        { status: 500 }
      );
    }

    console.log(
      "[Template Exercises API] Exercise added to session:",
      sessionExercise.id
    );

    return NextResponse.json({
      success: true,
      sessionExercise,
    });
  } catch (error) {
    console.error("[Template Exercises API] Unexpected error:", error);

    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// PUT - Update an exercise in a template session
export async function PUT(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ templateId: string; sessionId: string }>;
  }
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

    const { sessionId } = await params;
    const body = await request.json();
    const {
      sessionExerciseId,
      name,
      sets,
      reps,
      tempo,
      rest,
      trainingSystem,
      videoUrl,
      // Cardio-specific fields
      duration,
      distance,
      intensity,
      minHeartRate,
      maxHeartRate,
      type,
      notes,
    } = body;

    console.log(
      "[Template Exercises API] Updating session exercise:",
      sessionExerciseId
    );

    // Verify the session exercise belongs to this trainer
    const { data: sessionExercise, error: fetchError } = await supabase
      .from("session_exercises")
      .select("*, sessions!inner(trainer_id, session_type)")
      .eq("id", sessionExerciseId)
      .eq("session_id", sessionId)
      .single();

    if (fetchError || !sessionExercise) {
      console.error(
        "[Template Exercises API] Session exercise not found:",
        fetchError
      );

      return NextResponse.json(
        { success: false, error: "Ejercicio no encontrado" },
        { status: 404 }
      );
    }

    // Check trainer access
    if ((sessionExercise as any).sessions.trainer_id !== session.trainer_id) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 403 }
      );
    }

    const sessionType = (sessionExercise as any).sessions.session_type;

    // Build metadata object
    const metadata: any = {};

    if (sessionType === "cardio") {
      if (type) metadata.cardio_type = type;
      if (intensity) metadata.intensity = intensity;
      if (minHeartRate && maxHeartRate) {
        metadata.heart_rate_zone = {
          min: parseInt(minHeartRate),
          max: parseInt(maxHeartRate),
        };
      }
    } else {
      if (tempo) metadata.tempo = tempo;
      if (trainingSystem) metadata.training_system = trainingSystem;
      if (rest) metadata.rest_description = rest;
    }

    if (notes) metadata.notes = notes;

    // Update the session exercise
    const { data: updated, error: updateError } = await supabase
      .from("session_exercises")
      .update({
        sets: sets ? parseInt(sets) : null,
        reps: reps || null,
        duration_seconds: duration ? parseInt(duration) * 60 : null,
        distance_meters: distance ? parseFloat(distance) * 1000 : null,
        rest_seconds: rest && !isNaN(parseInt(rest)) ? parseInt(rest) : null,
        metadata,
      })
      .eq("id", sessionExerciseId)
      .select("*, exercises(*)")
      .single();

    if (updateError) {
      console.error(
        "[Template Exercises API] Error updating exercise:",
        updateError
      );

      return NextResponse.json(
        { success: false, error: "Error al actualizar ejercicio" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      sessionExercise: updated,
    });
  } catch (error) {
    console.error("[Template Exercises API] Unexpected error:", error);

    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// DELETE - Remove an exercise from a template session
export async function DELETE(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ templateId: string; sessionId: string }>;
  }
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

    const { sessionId } = await params;
    const { searchParams } = new URL(request.url);
    const sessionExerciseId = searchParams.get("sessionExerciseId");

    if (!sessionExerciseId) {
      return NextResponse.json(
        { success: false, error: "Session Exercise ID is required" },
        { status: 400 }
      );
    }

    console.log(
      "[Template Exercises API] Deleting session exercise:",
      sessionExerciseId
    );

    // Verify the session exercise belongs to this trainer
    const { data: sessionExercise } = await supabase
      .from("session_exercises")
      .select("*, sessions!inner(trainer_id)")
      .eq("id", sessionExerciseId)
      .eq("session_id", sessionId)
      .single();

    if (!sessionExercise) {
      return NextResponse.json(
        { success: false, error: "Ejercicio no encontrado" },
        { status: 404 }
      );
    }

    // Check trainer access
    if ((sessionExercise as any).sessions.trainer_id !== session.trainer_id) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 403 }
      );
    }

    // Delete the session exercise
    const { error: deleteError } = await supabase
      .from("session_exercises")
      .delete()
      .eq("id", sessionExerciseId);

    if (deleteError) {
      console.error(
        "[Template Exercises API] Error deleting exercise:",
        deleteError
      );

      return NextResponse.json(
        { success: false, error: "Error al eliminar ejercicio" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Ejercicio eliminado exitosamente",
    });
  } catch (error) {
    console.error("[Template Exercises API] Unexpected error:", error);

    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
