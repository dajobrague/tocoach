import type { WorkoutProgram } from "@/types/training";

import { NextRequest, NextResponse } from "next/server";

import { getTrainerSession } from "@/lib/auth/session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";
import {
  getCurrentWeekRange,
  transformToWorkoutProgram,
} from "@/lib/utils/training-utils";

// GET - Fetch all programs for a client
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
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

    const { clientId } = await params;
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category"); // 'cardio' or 'strength' or null for all
    const status = searchParams.get("status"); // 'active', 'paused', 'completed', 'cancelled' or null for all

    console.log(
      "[Programs API] Fetching programs for client:",
      clientId,
      "category:",
      category,
      "status:",
      status
    );

    // Fetch client programs first with optional status filter
    let clientProgramsQuery = supabase
      .from("client_programs")
      .select("*")
      .eq("client_id", clientId)
      .eq("trainer_id", session.trainer_id);

    // Filter by status if provided
    if (status) {
      clientProgramsQuery = clientProgramsQuery.eq("status", status);
    }

    const { data: clientPrograms, error: programsError } =
      await clientProgramsQuery;

    if (programsError) {
      console.error(
        "[Programs API] Error fetching client programs:",
        programsError
      );

      return NextResponse.json(
        { success: false, error: "Error al obtener programas" },
        { status: 500 }
      );
    }

    if (!clientPrograms || clientPrograms.length === 0) {
      console.log("[Programs API] No programs found for client");

      return NextResponse.json({
        success: true,
        programs: [],
      });
    }

    // Fetch programs separately to avoid RLS issues with joins
    const programIds = clientPrograms.map((cp) => cp.program_id);
    let programsQuery = supabase
      .from("programs")
      .select("*")
      .in("id", programIds);

    // Filter by category if provided
    if (category) {
      // Use JSONB operator to filter by metadata.category
      programsQuery = programsQuery.filter(
        "metadata->>category",
        "eq",
        category
      );
    }

    const { data: programs, error: programsFetchError } = await programsQuery;

    if (programsFetchError) {
      console.error(
        "[Programs API] Error fetching programs:",
        programsFetchError
      );

      return NextResponse.json(
        { success: false, error: "Error al obtener programas" },
        { status: 500 }
      );
    }

    console.log(
      "[Programs API] Found",
      clientPrograms.length,
      "client programs"
    );
    console.log("[Programs API] Found", programs?.length || 0, "programs");

    // Create a map of programs by ID for easy lookup
    const programsMap = new Map((programs || []).map((p) => [p.id, p]));

    // For each program, fetch sessions and exercises
    const workoutPrograms: WorkoutProgram[] = [];

    for (const clientProgram of clientPrograms) {
      const program = programsMap.get(clientProgram.program_id);

      if (!program) {
        console.warn(
          "[Programs API] Program not found for client_program:",
          clientProgram.id,
          "program_id:",
          clientProgram.program_id
        );
        continue;
      }

      const programId = clientProgram.program_id;

      // Fetch sessions for this program
      const { data: sessions, error: sessionsError } = await supabase
        .from("sessions")
        .select("*")
        .eq("program_id", programId)
        .order("session_order", { ascending: true });

      if (sessionsError) {
        console.error("[Programs API] Error fetching sessions:", sessionsError);
        continue;
      }

      console.log(
        "[Programs API] Found",
        sessions?.length || 0,
        "sessions for program",
        programId
      );

      // Fetch session exercises for all sessions
      const sessionIds = sessions?.map((s) => s.id) || [];
      let sessionExercises: any[] = [];

      if (sessionIds.length > 0) {
        // Fetch session_exercises first
        const { data: sessionExercisesData, error: exercisesError } =
          await supabase
            .from("session_exercises")
            .select("*")
            .in("session_id", sessionIds)
            .order("exercise_order", { ascending: true });

        if (exercisesError) {
          console.error(
            "[Programs API] Error fetching session exercises:",
            exercisesError
          );
        } else if (sessionExercisesData && sessionExercisesData.length > 0) {
          // Fetch the actual exercises separately
          const exerciseIds = sessionExercisesData.map(
            (se: any) => se.exercise_id
          );
          const { data: exercisesData, error: exercisesDataError } =
            await supabase.from("exercises").select("*").in("id", exerciseIds);

          if (exercisesDataError) {
            console.error(
              "[Programs API] Error fetching exercises data:",
              exercisesDataError
            );
          } else {
            // Create a map of exercises by ID
            const exercisesMap = new Map(
              (exercisesData || []).map((e: any) => [e.id, e])
            );

            // Attach exercise data to session exercises
            sessionExercises = sessionExercisesData.map((se: any) => ({
              ...se,
              exercise: exercisesMap.get(se.exercise_id),
            }));
            console.log(
              "[Programs API] Found",
              sessionExercises.length,
              "exercises"
            );
          }
        }
      }

      // Map exercises to their sessions
      const sessionsWithExercises = (sessions || []).map((session) => ({
        ...session,
        session_exercises: sessionExercises.filter(
          (se) => se.session_id === session.id
        ),
      }));

      // Fetch scheduled sessions for current week to check completion status
      const weekRange = getCurrentWeekRange();
      const { data: scheduledSessions, error: scheduledError } = await supabase
        .from("scheduled_sessions")
        .select("*")
        .eq("client_id", clientId)
        .eq("client_program_id", clientProgram.id)
        .gte("scheduled_date", weekRange.start.toISOString().split("T")[0])
        .lte("scheduled_date", weekRange.end.toISOString().split("T")[0]);

      if (scheduledError) {
        console.error(
          "[Programs API] Error fetching scheduled sessions:",
          scheduledError
        );
      }

      // Transform to UI format
      const workoutProgram = transformToWorkoutProgram(
        { ...clientProgram, program } as any,
        sessionsWithExercises,
        scheduledSessions || []
      );

      workoutPrograms.push(workoutProgram);
    }

    console.log(
      "[Programs API] Returning",
      workoutPrograms.length,
      "transformed programs"
    );

    return NextResponse.json({
      success: true,
      programs: workoutPrograms,
    });
  } catch (error) {
    console.error("[Programs API] Unexpected error:", error);

    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// POST - Assign a new program to a client
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
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

    const { clientId } = await params;
    const body = await request.json();
    const {
      name,
      division,
      type,
      startDate,
      sessionsPerWeek,
      notes,
      category,
      goal,
    } = body;

    console.log("[Programs API] Creating program for client:", clientId, body);

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

    // First, create the program template
    const metadata: any = {
      type,
      sessions_per_week: parseInt(sessionsPerWeek),
    };

    // Add category and category-specific fields
    if (category) {
      metadata.category = category;
    }

    if (category === "cardio") {
      if (goal) metadata.goal = goal;
    } else {
      // For strength programs, division is required
      if (division) metadata.division = division;
    }

    const { data: program, error: programError } = await supabase
      .from("programs")
      .insert({
        tenant_host: tenant.host,
        trainer_id: session.trainer_id,
        name,
        description: notes || null,
        is_template: false,
        is_published: false,
        metadata,
      })
      .select()
      .single();

    if (programError || !program) {
      console.error("[Programs API] Error creating program:", programError);

      return NextResponse.json(
        { success: false, error: "Error al crear programa" },
        { status: 500 }
      );
    }

    console.log("[Programs API] Program created:", program.id);

    // Then, assign it to the client
    const { data: clientProgram, error: assignError } = await supabase
      .from("client_programs")
      .insert({
        tenant_host: tenant.host,
        client_id: clientId,
        program_id: program.id,
        trainer_id: session.trainer_id,
        start_date: startDate,
        status: "active",
        progress_percentage: 0,
        notes: notes || null,
      })
      .select()
      .single();

    if (assignError || !clientProgram) {
      console.error("[Programs API] Error assigning program:", assignError);
      // Cleanup: delete the program we just created
      await supabase.from("programs").delete().eq("id", program.id);

      return NextResponse.json(
        { success: false, error: "Error al asignar programa" },
        { status: 500 }
      );
    }

    console.log("[Programs API] Program assigned to client:", clientProgram.id);

    return NextResponse.json({
      success: true,
      clientProgramId: clientProgram.id,
      programId: program.id,
    });
  } catch (error) {
    console.error("[Programs API] Unexpected error:", error);

    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// PUT - Update a program
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
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
    const programId = searchParams.get("programId");

    if (!programId) {
      return NextResponse.json(
        { success: false, error: "Program ID requerido" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const {
      name,
      division,
      type,
      startDate,
      sessionsPerWeek,
      notes,
      category,
      goal,
    } = body;

    console.log("[Programs API] Updating program:", programId, body);

    // Build metadata object
    const metadata: any = {
      type,
      sessions_per_week: parseInt(sessionsPerWeek),
    };

    if (category) {
      metadata.category = category;
    }

    if (category === "cardio") {
      if (goal) metadata.goal = goal;
    } else {
      if (division) metadata.division = division;
    }

    // Update the program
    const { data: program, error: programError } = await supabase
      .from("programs")
      .update({
        name,
        description: notes || null,
        metadata,
        updated_at: new Date().toISOString(),
      })
      .eq("id", programId)
      .eq("trainer_id", session.trainer_id)
      .select()
      .single();

    if (programError || !program) {
      console.error("[Programs API] Error updating program:", programError);

      return NextResponse.json(
        { success: false, error: "Error al actualizar programa" },
        { status: 500 }
      );
    }

    // Update client_program start_date if changed
    const { error: clientProgramError } = await supabase
      .from("client_programs")
      .update({
        start_date: startDate,
        notes: notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq("program_id", programId)
      .eq("trainer_id", session.trainer_id);

    if (clientProgramError) {
      console.error(
        "[Programs API] Error updating client_program:",
        clientProgramError
      );
    }

    console.log("[Programs API] Program updated:", program.id);

    return NextResponse.json({
      success: true,
      programId: program.id,
    });
  } catch (error) {
    console.error("[Programs API] Unexpected error:", error);

    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
