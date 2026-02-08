import { NextRequest, NextResponse } from "next/server";

import { getTrainerSession } from "@/lib/auth/session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";

// POST - Add a new exercise to a session
export async function POST(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ clientId: string; programId: string; sessionId: string }>;
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
      "[Exercises API] Creating exercise for session:",
      sessionId,
      body
    );

    // Verify that the session belongs to this trainer
    const { data: sessionData, error: sessionError } = await supabase
      .from("sessions")
      .select("id, trainer_id, tenant_host, session_type")
      .eq("id", sessionId)
      .eq("trainer_id", session.trainer_id)
      .single();

    if (sessionError || !sessionData) {
      console.error(
        "[Exercises API] Session not found or unauthorized:",
        sessionError
      );

      return NextResponse.json(
        { success: false, error: "Sesión no encontrada o no autorizada" },
        { status: 404 }
      );
    }

    // First, create or find the exercise in the exercise library
    let exerciseId: string;

    // Check if an exercise with this name already exists for this trainer
    const { data: existingExercise } = await supabase
      .from("exercises")
      .select("id")
      .eq("name", name)
      .eq("trainer_id", session.trainer_id)
      .maybeSingle();

    if (existingExercise) {
      exerciseId = existingExercise.id;
      console.log("[Exercises API] Using existing exercise:", exerciseId);
    } else {
      // Determine exercise category based on session type
      const exerciseCategory =
        sessionData.session_type === "cardio" ? "cardio" : "strength";

      // Create a new exercise in the library
      const { data: newExercise, error: exerciseError } = await supabase
        .from("exercises")
        .insert({
          tenant_host: sessionData.tenant_host,
          trainer_id: session.trainer_id,
          name,
          category: exerciseCategory,
          video_url: videoUrl || null,
          is_public: false,
        })
        .select()
        .single();

      if (exerciseError || !newExercise) {
        console.error(
          "[Exercises API] Error creating exercise:",
          exerciseError
        );

        return NextResponse.json(
          { success: false, error: "Error al crear ejercicio" },
          { status: 500 }
        );
      }

      exerciseId = newExercise.id;
      console.log("[Exercises API] Created new exercise:", exerciseId);
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
        ? (existingExercises[0].exercise_order || 0) + 1
        : 1;

    // Build the session_exercise data based on exercise type
    const isCardio = sessionData.session_type === "cardio";
    const sessionExerciseData: any = {
      tenant_host: sessionData.tenant_host,
      session_id: sessionId,
      exercise_id: exerciseId,
      exercise_order: nextOrder,
      notes: notes || null,
    };

    if (isCardio) {
      // Cardio exercise fields
      if (duration)
        sessionExerciseData.duration_seconds = parseInt(duration) * 60; // Convert minutes to seconds
      if (distance)
        sessionExerciseData.distance_meters = parseFloat(distance) * 1000; // Convert km to meters

      const metadata: any = {};

      if (intensity) metadata.intensity = intensity;
      if (type) metadata.cardio_type = type;
      if (minHeartRate) metadata.heart_rate_min = parseInt(minHeartRate);
      if (maxHeartRate) metadata.heart_rate_max = parseInt(maxHeartRate);

      sessionExerciseData.metadata = metadata;
    } else {
      // Strength exercise fields
      sessionExerciseData.sets = parseInt(sets);
      sessionExerciseData.reps = reps;
      sessionExerciseData.metadata = {
        tempo,
        training_system: trainingSystem,
        rest_description: rest,
      };
    }

    // Add the exercise to the session
    const { data: sessionExercise, error: sessionExerciseError } =
      await supabase
        .from("session_exercises")
        .insert(sessionExerciseData)
        .select()
        .single();

    if (sessionExerciseError || !sessionExercise) {
      console.error(
        "[Exercises API] Error adding exercise to session:",
        sessionExerciseError
      );

      return NextResponse.json(
        { success: false, error: "Error al añadir ejercicio a la sesión" },
        { status: 500 }
      );
    }

    console.log(
      "[Exercises API] Exercise added to session:",
      sessionExercise.id
    );

    return NextResponse.json({
      success: true,
      sessionExercise,
    });
  } catch (error) {
    console.error("[Exercises API] Unexpected error:", error);

    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// PUT - Update an exercise in a session
export async function PUT(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ clientId: string; programId: string; sessionId: string }>;
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

    const { searchParams } = new URL(request.url);
    const exerciseId = searchParams.get("exerciseId");

    if (!exerciseId) {
      return NextResponse.json(
        { success: false, error: "Exercise ID requerido" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const {
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

    console.log("[Exercises API] Updating exercise:", exerciseId, body);

    // Get the session_exercise to find the exercise_id and session info
    const { data: sessionExercise, error: seError } = await supabase
      .from("session_exercises")
      .select("exercise_id, tenant_host, session_id, sessions(session_type)")
      .eq("id", exerciseId)
      .single();

    if (seError || !sessionExercise) {
      console.error("[Exercises API] Session exercise not found:", seError);

      return NextResponse.json(
        { success: false, error: "Ejercicio no encontrado" },
        { status: 404 }
      );
    }

    // Update the exercise in the library
    const { error: exerciseError } = await supabase
      .from("exercises")
      .update({
        name,
        video_url: videoUrl || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", sessionExercise.exercise_id)
      .eq("trainer_id", session.trainer_id);

    if (exerciseError) {
      console.error("[Exercises API] Error updating exercise:", exerciseError);
    }

    // Determine if this is a cardio exercise
    const isCardio =
      (sessionExercise as any).sessions?.session_type === "cardio";

    // Build update data based on exercise type
    const updateData: any = {
      notes: notes || null,
      updated_at: new Date().toISOString(),
    };

    if (isCardio) {
      // Cardio exercise fields
      if (duration) updateData.duration_seconds = parseInt(duration) * 60;
      if (distance) updateData.distance_meters = parseFloat(distance) * 1000;

      const metadata: any = {};

      if (intensity) metadata.intensity = intensity;
      if (type) metadata.cardio_type = type;
      if (minHeartRate) metadata.heart_rate_min = parseInt(minHeartRate);
      if (maxHeartRate) metadata.heart_rate_max = parseInt(maxHeartRate);

      updateData.metadata = metadata;
    } else {
      // Strength exercise fields
      updateData.sets = parseInt(sets);
      updateData.reps = reps;
      updateData.metadata = {
        tempo,
        training_system: trainingSystem,
        rest_description: rest,
      };
    }

    // Update the session_exercise
    const { data: updatedSessionExercise, error: updateError } = await supabase
      .from("session_exercises")
      .update(updateData)
      .eq("id", exerciseId)
      .select()
      .single();

    if (updateError || !updatedSessionExercise) {
      console.error(
        "[Exercises API] Error updating session exercise:",
        updateError
      );

      return NextResponse.json(
        { success: false, error: "Error al actualizar ejercicio" },
        { status: 500 }
      );
    }

    console.log("[Exercises API] Exercise updated:", exerciseId);

    return NextResponse.json({
      success: true,
      sessionExercise: updatedSessionExercise,
    });
  } catch (error) {
    console.error("[Exercises API] Unexpected error:", error);

    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// DELETE - Delete an exercise from a session
export async function DELETE(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ clientId: string; programId: string; sessionId: string }>;
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

    const { searchParams } = new URL(request.url);
    const exerciseId = searchParams.get("exerciseId");

    if (!exerciseId) {
      return NextResponse.json(
        { success: false, error: "Exercise ID requerido" },
        { status: 400 }
      );
    }

    console.log("[Exercises API] Deleting exercise:", exerciseId);

    // Delete the session_exercise (the exercise library entry stays)
    const { error: deleteError } = await supabase
      .from("session_exercises")
      .delete()
      .eq("id", exerciseId);

    if (deleteError) {
      console.error(
        "[Exercises API] Error deleting session exercise:",
        deleteError
      );

      return NextResponse.json(
        { success: false, error: "Error al eliminar ejercicio" },
        { status: 500 }
      );
    }

    console.log("[Exercises API] Exercise deleted:", exerciseId);

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("[Exercises API] Unexpected error:", error);

    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// PATCH - Reorder exercises in a session
export async function PATCH(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ clientId: string; programId: string; sessionId: string }>;
  }
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

    const { sessionId } = await params;
    const body = await request.json();
    const { reorder } = body;

    if (!reorder || !Array.isArray(reorder)) {
      return NextResponse.json(
        { success: false, error: "Se requiere un array de reorder" },
        { status: 400 }
      );
    }

    // Verify session belongs to this trainer's program
    const { data: sessionData, error: sessionError } = await supabase
      .from("sessions")
      .select("id, trainer_id, program_id")
      .eq("id", sessionId)
      .eq("trainer_id", session.trainer_id)
      .single();

    if (sessionError || !sessionData) {
      return NextResponse.json(
        { success: false, error: "Sesión no encontrada o no autorizada" },
        { status: 404 }
      );
    }

    // Batch update exercise_order for each exercise
    const updatePromises = reorder.map(
      (item: { id: string; exercise_order: number }) =>
        supabase
          .from("session_exercises")
          .update({ exercise_order: item.exercise_order })
          .eq("id", item.id)
          .eq("session_id", sessionId)
    );

    const results = await Promise.all(updatePromises);
    const hasError = results.some((r) => r.error);

    if (hasError) {
      console.error(
        "[Exercises API] Error reordering exercises:",
        results.filter((r) => r.error).map((r) => r.error)
      );

      return NextResponse.json(
        { success: false, error: "Error al reordenar ejercicios" },
        { status: 500 }
      );
    }

    console.log("[Exercises API] Exercises reordered successfully");

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Exercises API] Unexpected error:", error);

    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
