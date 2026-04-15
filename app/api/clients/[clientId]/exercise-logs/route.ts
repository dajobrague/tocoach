import { NextRequest, NextResponse } from "next/server";

import { getClientSession } from "@/lib/auth/client-session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";

function parseWeightKg(weight: string): number | null {
  if (!weight) return null;
  const match = weight.match(/[\d.]+/);

  return match ? parseFloat(match[0]) : null;
}

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
    const session = await getClientSession();

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
    const sessionId = searchParams.get("sessionId");

    if (session.client_id.toString() !== clientId) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 403 }
      );
    }

    let query = supabase
      .from("exercise_logs")
      .select(
        "*, scheduled_sessions!inner(scheduled_date), exercise_log_sets(id, set_number, reps, weight_kg)"
      )
      .eq("client_id", clientId)
      .order("completed_at", { ascending: false });

    if (startDate) {
      query = query.gte("scheduled_sessions.scheduled_date", startDate);
    }
    if (endDate) {
      query = query.lte("scheduled_sessions.scheduled_date", endDate);
    }
    if (sessionId) {
      query = query.eq("scheduled_session_id", sessionId);
    }

    const { data: exerciseLogs, error: logsError } = await query;

    if (logsError) {
      console.error("[Exercise Logs API] Error fetching:", logsError);

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
          ? (log.distance_meters / 1000).toFixed(1)
          : null,
      };
    });

    return NextResponse.json({
      success: true,
      exerciseLogs: flattenedLogs,
    });
  } catch (error) {
    console.error("[Exercise Logs API] Unexpected error:", error);

    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const supabase = createSupabaseClient();

  try {
    const session = await getClientSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 401 }
      );
    }

    const { clientId } = await params;
    const body = await request.json();
    const {
      sessionId,
      exerciseId,
      scheduledDate,
      sets,
      videoUrl,
      durationCompleted,
      distanceCompleted,
      intensityCompleted,
      avgHeartRate,
      notes,
    } = body;

    if (session.client_id.toString() !== clientId) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 403 }
      );
    }

    console.log("[Exercise Logs API] Creating log:", body);

    const { data: sessionData, error: sessionError } = await supabase
      .from("sessions")
      .select("trainer_id, tenant_host")
      .eq("id", sessionId)
      .single();

    if (sessionError || !sessionData) {
      console.error("[Exercise Logs API] Session not found:", sessionError);

      return NextResponse.json(
        { success: false, error: "Sesión no encontrada" },
        { status: 404 }
      );
    }

    let scheduledSessionId: string;

    const { data: existingScheduled } = await supabase
      .from("scheduled_sessions")
      .select("id")
      .eq("session_id", sessionId)
      .eq("client_id", clientId)
      .eq("scheduled_date", scheduledDate)
      .maybeSingle();

    if (existingScheduled) {
      scheduledSessionId = existingScheduled.id;
    } else {
      const { data: newScheduled, error: scheduledCreateError } = await supabase
        .from("scheduled_sessions")
        .insert({
          tenant_host: sessionData.tenant_host,
          session_id: sessionId,
          client_id: parseInt(clientId),
          trainer_id: sessionData.trainer_id,
          scheduled_date: scheduledDate,
          status: "scheduled",
        })
        .select("id")
        .single();

      if (scheduledCreateError || !newScheduled) {
        console.error(
          "[Exercise Logs API] Error creating scheduled session:",
          scheduledCreateError
        );

        return NextResponse.json(
          { success: false, error: "Error al crear sesión programada" },
          { status: 500 }
        );
      }

      scheduledSessionId = newScheduled.id;
    }

    const isCardio = !!(durationCompleted || distanceCompleted);

    const metadata: any = {};

    if (intensityCompleted) metadata.intensity = intensityCompleted;
    if (avgHeartRate) metadata.avg_heart_rate = parseInt(avgHeartRate);

    const logData: any = {
      tenant_host: sessionData.tenant_host,
      scheduled_session_id: scheduledSessionId,
      exercise_id: exerciseId,
      client_id: parseInt(clientId),
      trainer_id: sessionData.trainer_id,
      notes: notes || null,
      completed_at: new Date().toISOString(),
      video_url: videoUrl || null,
      metadata: Object.keys(metadata).length > 0 ? metadata : null,
    };

    if (isCardio) {
      if (durationCompleted) {
        logData.duration_seconds = parseInt(durationCompleted) * 60;
      }
      if (distanceCompleted) {
        logData.distance_meters = parseFloat(distanceCompleted) * 1000;
      }
    }

    const { data: existingExerciseLog } = await supabase
      .from("exercise_logs")
      .select("id")
      .eq("scheduled_session_id", scheduledSessionId)
      .eq("exercise_id", exerciseId)
      .eq("client_id", parseInt(clientId))
      .maybeSingle();

    let exerciseLog: any;
    let createError: any;

    if (existingExerciseLog) {
      const { data, error } = await supabase
        .from("exercise_logs")
        .update({ ...logData, completed_at: new Date().toISOString() })
        .eq("id", existingExerciseLog.id)
        .select()
        .single();

      exerciseLog = data;
      createError = error;
      if (!createError)
        console.log("[Exercise Logs API] Updated:", exerciseLog?.id);
    } else {
      const { data, error } = await supabase
        .from("exercise_logs")
        .insert(logData)
        .select()
        .single();

      exerciseLog = data;
      createError = error;
      if (!createError)
        console.log("[Exercise Logs API] Created:", exerciseLog?.id);
    }

    if (createError || !exerciseLog) {
      console.error("[Exercise Logs API] Error saving:", createError);

      return NextResponse.json(
        { success: false, error: "Error al guardar registro de ejercicio" },
        { status: 500 }
      );
    }

    let savedSets: any[] = [];

    if (!isCardio && Array.isArray(sets) && sets.length > 0) {
      await supabase
        .from("exercise_log_sets")
        .delete()
        .eq("exercise_log_id", exerciseLog.id);

      const setRows = sets.map((s: any, i: number) => ({
        exercise_log_id: exerciseLog.id,
        set_number: i + 1,
        reps: s.reps != null ? parseInt(s.reps) : null,
        weight_kg: parseWeightKg(String(s.weight ?? "")),
      }));

      const { data: insertedSets, error: setsError } = await supabase
        .from("exercise_log_sets")
        .insert(setRows)
        .select("id, set_number, reps, weight_kg");

      if (setsError) {
        console.error("[Exercise Logs API] Error saving sets:", setsError);
      } else {
        savedSets = insertedSets ?? [];
      }
    }

    const flattenedLog: any = {
      ...exerciseLog,
      scheduled_date: scheduledDate,
      sets: savedSets.sort((a: any, b: any) => a.set_number - b.set_number),
    };

    if (exerciseLog.duration_seconds) {
      flattenedLog.duration_minutes = Math.round(
        exerciseLog.duration_seconds / 60
      );
    }
    if (exerciseLog.distance_meters) {
      flattenedLog.distance_km = (exerciseLog.distance_meters / 1000).toFixed(
        1
      );
    }
    if (exerciseLog.metadata?.intensity) {
      flattenedLog.intensity = exerciseLog.metadata.intensity;
    }
    if (exerciseLog.metadata?.avg_heart_rate) {
      flattenedLog.avg_heart_rate = exerciseLog.metadata.avg_heart_rate;
    }

    return NextResponse.json({
      success: true,
      exerciseLog: flattenedLog,
    });
  } catch (error) {
    console.error("[Exercise Logs API] Unexpected error:", error);

    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
