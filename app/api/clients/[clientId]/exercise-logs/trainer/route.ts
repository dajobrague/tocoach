import { NextRequest, NextResponse } from "next/server";

import { getTrainerSession } from "@/lib/auth/session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";

function buildSetsFromLegacy(log: any) {
  const count = log.sets_completed ?? 1;
  const repsStr = log.reps_completed;
  let reps: number | null = null;

  if (repsStr) {
    const m = String(repsStr).match(/\d+/);

    if (m) reps = parseInt(m[0]);
  }

  return Array.from({ length: count }, (_, i) => ({
    set_number: i + 1,
    reps,
    weight_kg: log.weight_kg ?? null,
  }));
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
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

    const { clientId } = await params;
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("id, tenant")
      .eq("id", clientId)
      .single();

    if (clientError || !client || client.tenant !== session.trainer_id) {
      console.warn(
        "[Trainer Exercise Logs API] Client not found or not owned by trainer:",
        {
          clientId,
          trainerId: session.trainer_id,
          clientTenant: client?.tenant,
        }
      );

      return NextResponse.json(
        { success: false, error: "Cliente no encontrado" },
        { status: 404 }
      );
    }

    let query = supabase
      .from("exercise_logs")
      .select(
        `*, exercises(id, name, category, muscle_groups), scheduled_sessions!inner(scheduled_date), exercise_log_sets(id, set_number, reps, weight_kg)`
      )
      .eq("client_id", clientId)
      .order("completed_at", { ascending: true });

    if (startDate) {
      query = query.gte("scheduled_sessions.scheduled_date", startDate);
    }
    if (endDate) {
      query = query.lte("scheduled_sessions.scheduled_date", endDate);
    }

    const { data: exerciseLogs, error: logsError } = await query;

    if (logsError) {
      console.error("[Trainer Exercise Logs API] Error fetching:", logsError);

      return NextResponse.json(
        { success: false, error: "Error al obtener registros de ejercicios" },
        { status: 500 }
      );
    }

    const flattenedLogs = (exerciseLogs || []).map((log: any) => {
      const rawSets = log.exercise_log_sets ?? [];
      const sets =
        rawSets.length > 0
          ? rawSets.sort((a: any, b: any) => a.set_number - b.set_number)
          : buildSetsFromLegacy(log);

      return {
        ...log,
        exercise_log_sets: undefined,
        scheduled_sessions: undefined,
        scheduled_date: log.scheduled_sessions?.scheduled_date,
        sets,
        weight_used:
          log.metadata?.weight_used_original ||
          (log.weight_kg ? `${log.weight_kg}kg` : null),
        intensity: log.metadata?.intensity,
        avg_heart_rate: log.metadata?.avg_heart_rate,
        duration_minutes: log.duration_seconds
          ? Math.round(log.duration_seconds / 60)
          : null,
        distance_km: log.distance_meters
          ? parseFloat((log.distance_meters / 1000).toFixed(1))
          : null,
      };
    });

    return NextResponse.json({
      success: true,
      exerciseLogs: flattenedLogs,
    });
  } catch (error) {
    console.error("[Trainer Exercise Logs API] Unexpected error:", error);

    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
