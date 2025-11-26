import { NextRequest, NextResponse } from "next/server";

import { getClientSession } from "@/lib/auth/client-session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";

// GET - Fetch exercise logs for a client within a date range
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
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

    const { clientId } = await params;
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const sessionId = searchParams.get("sessionId");

    // Verify client is requesting their own data
    if (session.client_id.toString() !== clientId) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 403 }
      );
    }

    let query = supabase
      .from("exercise_logs")
      .select("*, scheduled_sessions!inner(scheduled_date)")
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

    // Flatten the data structure for easier use in UI
    const flattenedLogs = (exerciseLogs || []).map((log: any) => ({
      ...log,
      scheduled_date: log.scheduled_sessions?.scheduled_date,
      // Use original weight format from metadata if available, otherwise format weight_kg
      weight_used:
        log.metadata?.weight_used_original ||
        (log.weight_kg ? `${log.weight_kg}kg` : null),
      // Cardio fields from metadata
      intensity: log.metadata?.intensity,
      avg_heart_rate: log.metadata?.avg_heart_rate,
      // Convert stored values back to UI-friendly units
      duration_minutes: log.duration_seconds
        ? Math.round(log.duration_seconds / 60)
        : null,
      distance_km: log.distance_meters
        ? (log.distance_meters / 1000).toFixed(1)
        : null,
    }));

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

// POST - Create an exercise log
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
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

    const { clientId } = await params;
    const body = await request.json();
    const {
      sessionId,
      exerciseId,
      scheduledDate,
      // Strength fields
      setsCompleted,
      repsCompleted,
      weightUsed,
      // Cardio fields
      durationCompleted,
      distanceCompleted,
      intensityCompleted,
      avgHeartRate,
      // Common
      notes,
    } = body;

    // Verify client is creating for themselves
    if (session.client_id.toString() !== clientId) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 403 }
      );
    }

    console.log("[Exercise Logs API] Creating log:", body);

    // Get the session to find trainer_id and tenant_host
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

    // Find or create scheduled_session for this date
    let scheduledSessionId: string;

    const { data: existingScheduled, error: scheduledFindError } =
      await supabase
        .from("scheduled_sessions")
        .select("id")
        .eq("session_id", sessionId)
        .eq("client_id", clientId)
        .eq("scheduled_date", scheduledDate)
        .maybeSingle();

    if (existingScheduled) {
      scheduledSessionId = existingScheduled.id;
    } else {
      // Create new scheduled session
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

    // Parse weight - extract number from string like "20kg" or "20"
    let weightKg: number | null = null;

    if (weightUsed) {
      const weightMatch = weightUsed.match(/[\d.]+/);

      if (weightMatch) {
        weightKg = parseFloat(weightMatch[0]);
      }
    }

    // Build metadata object
    const metadata: any = {};

    if (weightUsed) {
      metadata.weight_used_original = weightUsed; // Store original format like "20kg", "BW+10kg", etc.
    }
    if (intensityCompleted) {
      metadata.intensity = intensityCompleted;
    }
    if (avgHeartRate) {
      metadata.avg_heart_rate = parseInt(avgHeartRate);
    }

    // Create exercise log with appropriate fields
    const logData: any = {
      tenant_host: sessionData.tenant_host,
      scheduled_session_id: scheduledSessionId,
      exercise_id: exerciseId,
      client_id: parseInt(clientId),
      trainer_id: sessionData.trainer_id,
      notes: notes || null,
      completed_at: new Date().toISOString(),
      metadata: Object.keys(metadata).length > 0 ? metadata : null,
    };

    // Add strength or cardio specific fields
    if (durationCompleted || distanceCompleted) {
      // Cardio exercise
      if (durationCompleted) {
        logData.duration_seconds = parseInt(durationCompleted) * 60; // Convert minutes to seconds
      }
      if (distanceCompleted) {
        logData.distance_meters = parseFloat(distanceCompleted) * 1000; // Convert km to meters
      }
    } else {
      // Strength exercise
      logData.sets_completed = setsCompleted;
      logData.reps_completed = repsCompleted;
      logData.weight_kg = weightKg;
    }

    const { data: exerciseLog, error: createError } = await supabase
      .from("exercise_logs")
      .insert(logData)
      .select()
      .single();

    if (createError || !exerciseLog) {
      console.error("[Exercise Logs API] Error creating:", createError);

      return NextResponse.json(
        { success: false, error: "Error al crear registro de ejercicio" },
        { status: 500 }
      );
    }

    console.log("[Exercise Logs API] Created:", exerciseLog.id);

    // Return flattened format for consistency with GET
    const flattenedLog: any = {
      ...exerciseLog,
      scheduled_date: scheduledDate,
    };

    // Add appropriate fields based on log type
    if (weightUsed) {
      flattenedLog.weight_used = weightUsed;
    }
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
