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

    // Batch the per-program fan-out: one query per LEVEL (sessions,
    // session_exercises, exercises, scheduled_sessions) instead of 4 per
    // program.
    const workoutPrograms: WorkoutProgram[] = [];
    const validClientPrograms = clientPrograms.filter((clientProgram) => {
      if (programsMap.has(clientProgram.program_id)) return true;

      console.warn(
        "[Client Programs API] Program not found for client_program:",
        clientProgram.id,
        "program_id:",
        clientProgram.program_id
      );

      return false;
    });

    if (validClientPrograms.length > 0) {
      const validProgramIds = validClientPrograms.map((cp) => cp.program_id);
      const { data: allSessions, error: sessionsError } = await supabase
        .from("sessions")
        .select("*")
        .in("program_id", validProgramIds)
        .order("session_order", { ascending: true });

      if (sessionsError) {
        // Same behavior as the old per-program loop on a sessions error:
        // the affected programs are skipped (here: all of them).
        console.error(
          "[Client Programs API] Error fetching sessions:",
          sessionsError
        );
      } else {
        const sessions: any[] = allSessions || [];

        console.log(
          "[Client Programs API] Found",
          sessions.length,
          "sessions across",
          validClientPrograms.length,
          "programs"
        );

        const allSessionIds = sessions.map((s) => s.id);
        const weekRange = getCurrentWeekRange();

        // session_exercises + scheduled_sessions only depend on the session
        // ids, so they run in parallel.
        let sessionExercises: any[] = [];
        let allScheduled: any[] = [];

        if (allSessionIds.length > 0) {
          // Scheduled sessions: filtramos por session_id (las sesiones de
          // estos programas), no por client_program_id: los flujos actuales
          // (exercise-log save, /start, /complete vía
          // upsert_scheduled_session) dejan client_program_id NULL, así que
          // ese filtro nunca matcheaba filas creadas por el cliente y
          // `completed` salía siempre false.
          const [exercisesResult, scheduledResult] = await Promise.all([
            supabase
              .from("session_exercises")
              .select("*")
              .in("session_id", allSessionIds)
              .order("exercise_order", { ascending: true }),
            supabase
              .from("scheduled_sessions")
              .select("*")
              .eq("client_id", clientId)
              .in("session_id", allSessionIds)
              .gte(
                "scheduled_date",
                weekRange.start.toISOString().split("T")[0]
              )
              .lte("scheduled_date", weekRange.end.toISOString().split("T")[0]),
          ]);

          if (scheduledResult.error) {
            console.error(
              "[Client Programs API] Error fetching scheduled sessions:",
              scheduledResult.error
            );
          } else {
            allScheduled = scheduledResult.data || [];
          }

          if (exercisesResult.error) {
            console.error(
              "[Client Programs API] Error fetching session exercises:",
              exercisesResult.error
            );
          } else if (exercisesResult.data && exercisesResult.data.length > 0) {
            const sessionExercisesData = exercisesResult.data;
            const exerciseIds = [
              ...new Set(sessionExercisesData.map((se: any) => se.exercise_id)),
            ];
            const { data: exercisesData, error: exercisesDataError } =
              await supabase
                .from("exercises")
                .select("*")
                .in("id", exerciseIds);

            if (exercisesDataError) {
              console.error(
                "[Client Programs API] Error fetching exercises data:",
                exercisesDataError
              );
            } else {
              const exercisesMap = new Map(
                (exercisesData || []).map((e: any) => [e.id, e])
              );

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

        for (const clientProgram of validClientPrograms) {
          const program = programsMap.get(clientProgram.program_id);
          const programSessions = sessions.filter(
            (session) => session.program_id === clientProgram.program_id
          );
          const programSessionIds = new Set(
            programSessions.map((session) => session.id)
          );
          const sessionsWithExercises = programSessions.map((session) => ({
            ...session,
            session_exercises: sessionExercises.filter(
              (se) => se.session_id === session.id
            ),
          }));
          const scheduledSessions = allScheduled.filter((ss) =>
            programSessionIds.has(ss.session_id)
          );

          const workoutProgram = transformToWorkoutProgram(
            { ...clientProgram, program } as any,
            sessionsWithExercises,
            scheduledSessions
          );

          workoutPrograms.push(workoutProgram);
        }
      }
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
