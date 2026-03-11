import { NextRequest, NextResponse } from "next/server";

import { getTrainerSession } from "@/lib/auth/session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";

// GET - Fetch exercise logs for a client (trainer-authenticated)
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

    let query = supabase
      .from("exercise_logs")
      .select(
        `*, exercises(id, name, category, muscle_groups), scheduled_sessions!inner(scheduled_date)`
      )
      .eq("client_id", clientId)
      .eq("tenant_host", session.tenant_host)
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

    const flattenedLogs = (exerciseLogs || []).map((log: any) => ({
      ...log,
      scheduled_date: log.scheduled_sessions?.scheduled_date,
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
    }));

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
