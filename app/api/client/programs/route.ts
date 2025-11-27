import type { WorkoutProgram } from "@/types/training";

import { NextRequest, NextResponse } from "next/server";

import { getClientSession } from "@/lib/auth/client-session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";
import {
  getCurrentWeekRange,
  transformToWorkoutProgram,
} from "@/lib/utils/training-utils";

// GET - Fetch all programs for the authenticated client
export async function GET(request: NextRequest) {
  const supabase = createSupabaseClient();

  try {
    // Authenticate client
    const session = await getClientSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 401 }
      );
    }

    const clientId = session.client_id;
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category"); // 'cardio' or 'strength' or null for all

    console.log(
      "[Client Programs API] Fetching programs for client:",
      clientId,
      "category:",
      category
    );

    // Fetch client programs first
    const { data: clientPrograms, error: programsError } = await supabase
      .from("client_programs")
      .select("*")
      .eq("client_id", clientId);

    if (programsError) {
      console.error(
        "[Client Programs API] Error fetching client programs:",
        programsError
      );

      return NextResponse.json(
        { success: false, error: "Error al obtener programas" },
        { status: 500 }
      );
    }

    if (!clientPrograms || clientPrograms.length === 0) {
      console.log("[Client Programs API] No programs found for client");

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
        "[Client Programs API] Error fetching programs:",
        programsFetchError
      );

      return NextResponse.json(
        { success: false, error: "Error al obtener programas" },
        { status: 500 }
      );
    }

    console.log(
      "[Client Programs API] Found",
      clientPrograms.length,
      "client programs"
    );
    console.log(
      "[Client Programs API] Found",
      programs?.length || 0,
      "programs"
    );

    // Create a map of programs by ID for easy lookup
    const programsMap = new Map((programs || []).map((p) => [p.id, p]));

    // For each program, fetch sessions and exercises
    const workoutPrograms: WorkoutProgram[] = [];

    for (const clientProgram of clientPrograms) {
      const program = programsMap.get(clientProgram.program_id);

      if (!program) {
        console.warn(
          "[Client Programs API] Program not found for client_program:",
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
        console.error(
          "[Client Programs API] Error fetching sessions:",
          sessionsError
        );
        continue;
      }

      console.log(
        "[Client Programs API] Found",
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
            "[Client Programs API] Error fetching session exercises:",
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
              "[Client Programs API] Error fetching exercises data:",
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
              "[Client Programs API] Found",
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
          "[Client Programs API] Error fetching scheduled sessions:",
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
      "[Client Programs API] Returning",
      workoutPrograms.length,
      "transformed programs"
    );

    return NextResponse.json({
      success: true,
      programs: workoutPrograms,
    });
  } catch (error) {
    console.error("[Client Programs API] Unexpected error:", error);

    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
