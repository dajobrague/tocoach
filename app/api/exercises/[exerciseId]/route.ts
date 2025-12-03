import { NextRequest, NextResponse } from "next/server";

import { getTrainerSession } from "@/lib/auth/session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";

// GET - Fetch a single exercise
export async function GET(
  request: NextRequest,
  { params }: { params: { exerciseId: string } }
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

    const { exerciseId } = params;

    console.log(
      "[Exercise Library API] Fetching exercise:",
      exerciseId,
      "for trainer:",
      session.trainer_id
    );

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

    // Fetch the exercise
    const { data: exercise, error: exerciseError } = await supabase
      .from("exercises")
      .select("*")
      .eq("id", exerciseId)
      .eq("tenant_host", tenant.host)
      .eq("trainer_id", session.trainer_id)
      .single();

    if (exerciseError) {
      console.error(
        "[Exercise Library API] Error fetching exercise:",
        exerciseError
      );

      return NextResponse.json(
        { success: false, error: "Ejercicio no encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      exercise,
    });
  } catch (error) {
    console.error("[Exercise Library API] Unexpected error:", error);

    return NextResponse.json(
      { success: false, error: "Error inesperado" },
      { status: 500 }
    );
  }
}

// PUT - Update an exercise
export async function PUT(
  request: NextRequest,
  { params }: { params: { exerciseId: string } }
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

    const { exerciseId } = params;
    const body = await request.json();

    console.log(
      "[Exercise Library API] Updating exercise:",
      exerciseId,
      "with data:",
      body
    );

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

    // Build update object
    const updateData: any = {};

    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined)
      updateData.description = body.description || null;
    if (body.category !== undefined) updateData.category = body.category;
    if (body.muscle_groups !== undefined)
      updateData.muscle_groups = body.muscle_groups || [];
    if (body.equipment !== undefined)
      updateData.equipment = body.equipment || [];
    if (body.difficulty_level !== undefined)
      updateData.difficulty_level = body.difficulty_level || null;
    if (body.video_url !== undefined)
      updateData.video_url = body.video_url || null;
    if (body.image_url !== undefined)
      updateData.image_url = body.image_url || null;
    if (body.instructions !== undefined)
      updateData.instructions = body.instructions || [];
    if (body.tips !== undefined) updateData.tips = body.tips || [];

    // Default training parameters
    if (body.default_sets !== undefined)
      updateData.default_sets = body.default_sets
        ? parseInt(body.default_sets, 10)
        : null;
    if (body.default_reps !== undefined)
      updateData.default_reps = body.default_reps || null;
    if (body.default_tempo !== undefined)
      updateData.default_tempo = body.default_tempo || null;
    if (body.default_rest_seconds !== undefined)
      updateData.default_rest_seconds = body.default_rest_seconds
        ? parseInt(body.default_rest_seconds, 10)
        : null;
    if (body.default_training_system !== undefined)
      updateData.default_training_system = body.default_training_system || null;

    updateData.updated_at = new Date().toISOString();

    // Update the exercise
    const { data: exercise, error: exerciseError } = await supabase
      .from("exercises")
      .update(updateData)
      .eq("id", exerciseId)
      .eq("tenant_host", tenant.host)
      .eq("trainer_id", session.trainer_id)
      .select()
      .single();

    if (exerciseError) {
      console.error(
        "[Exercise Library API] Error updating exercise:",
        exerciseError
      );

      return NextResponse.json(
        { success: false, error: "Error al actualizar ejercicio" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      exercise,
    });
  } catch (error) {
    console.error("[Exercise Library API] Unexpected error:", error);

    return NextResponse.json(
      { success: false, error: "Error inesperado" },
      { status: 500 }
    );
  }
}

// DELETE - Delete an exercise
export async function DELETE(
  request: NextRequest,
  { params }: { params: { exerciseId: string } }
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

    const { exerciseId } = params;

    console.log(
      "[Exercise Library API] Deleting exercise:",
      exerciseId,
      "for trainer:",
      session.trainer_id
    );

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

    // Check if exercise is used in any sessions
    const { data: usedInSessions, error: checkError } = await supabase
      .from("session_exercises")
      .select("id")
      .eq("exercise_id", exerciseId)
      .limit(1);

    if (checkError) {
      console.error(
        "[Exercise Library API] Error checking exercise usage:",
        checkError
      );

      return NextResponse.json(
        { success: false, error: "Error al verificar uso del ejercicio" },
        { status: 500 }
      );
    }

    if (usedInSessions && usedInSessions.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No se puede eliminar este ejercicio porque está siendo usado en programas activos",
        },
        { status: 400 }
      );
    }

    // Delete the exercise
    const { error: deleteError } = await supabase
      .from("exercises")
      .delete()
      .eq("id", exerciseId)
      .eq("tenant_host", tenant.host)
      .eq("trainer_id", session.trainer_id);

    if (deleteError) {
      console.error(
        "[Exercise Library API] Error deleting exercise:",
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
    console.error("[Exercise Library API] Unexpected error:", error);

    return NextResponse.json(
      { success: false, error: "Error inesperado" },
      { status: 500 }
    );
  }
}
