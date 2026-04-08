/* eslint-disable no-console */
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

      // If a videoUrl was provided, update the library exercise so the
      // video is available everywhere this exercise is referenced.
      if (videoUrl) {
        await supabase
          .from("exercises")
          .update({ video_url: videoUrl })
          .eq("id", exerciseId);
      }
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
        notes: notes || null,
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
    const session = await getTrainerSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 401 }
      );
    }

    const { sessionId } = await params;
    const body = await request.json();

    console.log("[Exercise Update] Raw body received:", JSON.stringify(body));

    const {
      sessionExerciseId,
      name,
      sets,
      reps,
      rest_seconds,
      notes,
      videoUrl,
    } = body;

    if (!sessionExerciseId) {
      return NextResponse.json(
        { success: false, error: "sessionExerciseId is required" },
        { status: 400 }
      );
    }

    // Step 1: Read current row to get the exercise_id (needed for name update)
    const { data: before, error: readError } = await supabase
      .from("session_exercises")
      .select("id, exercise_id, sets, reps, rest_seconds, notes")
      .eq("id", sessionExerciseId)
      .eq("session_id", sessionId)
      .single();

    if (readError || !before) {
      console.error("[Exercise Update] Row not found:", readError);

      return NextResponse.json(
        { success: false, error: "Ejercicio no encontrado" },
        { status: 404 }
      );
    }

    console.log("[Exercise Update] BEFORE:", JSON.stringify(before));

    // Step 2: Build session_exercises update payload — only touch provided fields
    const updatePayload: Record<string, any> = {};

    if (name !== undefined) {
      updatePayload.custom_name = name && name.trim() ? name.trim() : null;
    }

    if (sets !== undefined && sets !== null && sets !== "") {
      updatePayload.sets = parseInt(sets);
    } else if (sets === "" || sets === null) {
      updatePayload.sets = null;
    }

    if (reps !== undefined) {
      updatePayload.reps = reps || null;
    }

    if (
      rest_seconds !== undefined &&
      rest_seconds !== null &&
      rest_seconds !== ""
    ) {
      updatePayload.rest_seconds = parseInt(rest_seconds);
    } else if (rest_seconds === "" || rest_seconds === null) {
      updatePayload.rest_seconds = null;
    }

    if (notes !== undefined) {
      updatePayload.notes = notes || null;
    }

    // Step 4: Update session_exercises row (only if there are fields to update)
    if (Object.keys(updatePayload).length > 0) {
      const { error: updateError } = await supabase
        .from("session_exercises")
        .update(updatePayload)
        .eq("id", sessionExerciseId)
        .eq("session_id", sessionId);

      if (updateError) {
        console.error(
          "[Exercise Update] UPDATE ERROR:",
          JSON.stringify(updateError)
        );

        return NextResponse.json(
          {
            success: false,
            error: "Error al actualizar: " + updateError.message,
          },
          { status: 500 }
        );
      }
    }

    // Step 5: If videoUrl was provided, update the exercise library entry
    if (videoUrl !== undefined && before.exercise_id) {
      await supabase
        .from("exercises")
        .update({ video_url: videoUrl || null })
        .eq("id", before.exercise_id);
    }

    // Step 6: Read back the full row to return
    const { data: updated, error: verifyError } = await supabase
      .from("session_exercises")
      .select("*, exercises(*)")
      .eq("id", sessionExerciseId)
      .single();

    console.log("[Exercise Update] AFTER:", JSON.stringify(updated));

    if (verifyError) {
      console.error(
        "[Exercise Update] Verify error:",
        JSON.stringify(verifyError)
      );
    }

    return NextResponse.json({
      success: true,
      sessionExercise: updated,
    });
  } catch (error) {
    console.error("[Exercise Update] Unexpected error:", error);

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
    params: Promise<{ templateId: string; sessionId: string }>;
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

    const { templateId, sessionId } = await params;
    const body = await request.json();
    const { reorder } = body;

    if (!reorder || !Array.isArray(reorder)) {
      return NextResponse.json(
        { success: false, error: "Se requiere un array de reorder" },
        { status: 400 }
      );
    }

    // Verify session belongs to this trainer's template
    const { data: sessionData, error: sessionError } = await supabase
      .from("sessions")
      .select("id, trainer_id, program_id")
      .eq("id", sessionId)
      .eq("program_id", templateId)
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
        "[Template Exercises API] Error reordering exercises:",
        results.filter((r) => r.error).map((r) => r.error)
      );

      return NextResponse.json(
        { success: false, error: "Error al reordenar ejercicios" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Ejercicios reordenados exitosamente",
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
