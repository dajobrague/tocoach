import { NextRequest, NextResponse } from "next/server";

import { getClientSession } from "@/lib/auth/client-session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";

function parseWeightKg(weight: string): number | null {
  if (!weight) return null;
  // El cliente en es-ES escribe decimales con coma ("80,5"). El regex
  // anterior `[\d.]+` cortaba al ver la coma y guardaba 80. Normalizamos
  // coma → punto antes de buscar el número.
  const normalized = weight.replace(",", ".");
  const match = normalized.match(/[\d.]+/);

  if (!match) return null;
  const n = parseFloat(match[0]);

  return Number.isFinite(n) ? n : null;
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
        "*, scheduled_sessions!inner(scheduled_date, session_id), exercise_log_sets(id, set_number, reps, weight_kg, video_url)"
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
        session_id: log.scheduled_sessions?.session_id,
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
      scheduledDate: scheduledDateRaw,
      sets,
      videoUrl,
      durationCompleted,
      distanceCompleted,
      intensityCompleted,
      avgHeartRate,
      notes,
      finalize,
    } = body;

    if (session.client_id.toString() !== clientId) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 403 }
      );
    }

    // scheduledDate ahora es opcional. El camino correcto es que el cliente
    // calcule la fecha local con getLocalTodayYmd() (lib/forms/client-helpers.ts)
    // y la mande en el body — esa función no es válida en servidor porque
    // depende del huso del navegador. Fallback defensivo a UTC hoy si el
    // cliente no la mandó: puede tener ±24h de deriva en clientes con TZ
    // muy alejada, pero evita romper la request.
    let scheduledDate: string = scheduledDateRaw;

    if (!scheduledDate) {
      scheduledDate = new Date().toISOString().slice(0, 10);
      console.warn(
        "[Exercise Logs API] scheduledDate missing in body, defaulted to UTC today:",
        { clientId, scheduledDate }
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

    // Atomic upsert via RPC con advisory lock por (client_id, date).
    // Antes el patrón SELECT-then-INSERT acá creaba duplicados bajo
    // concurrencia + cuando el trainer cambiaba session_id vía override
    // (el SELECT filtraba por session_id viejo y no encontraba).
    // F4.5 migration 104.
    const { data: scheduledSessionId, error: upsertError } = await supabase.rpc(
      "upsert_scheduled_session",
      {
        p_tenant_host: sessionData.tenant_host,
        p_client_id: parseInt(clientId),
        p_trainer_id: sessionData.trainer_id,
        p_session_id: sessionId,
        p_scheduled_date: scheduledDate,
        p_status: "scheduled",
      }
    );

    if (upsertError || !scheduledSessionId) {
      console.error(
        "[Exercise Logs API] Error upserting scheduled session:",
        upsertError
      );

      return NextResponse.json(
        { success: false, error: "Error al crear sesión programada" },
        { status: 500 }
      );
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
      .select("id, finalized_at")
      .eq("scheduled_session_id", scheduledSessionId)
      .eq("exercise_id", exerciseId)
      .eq("client_id", parseInt(clientId))
      .maybeSingle();

    // finalize=true: el cliente tocó "Finalizado" — el ejercicio queda
    // marcado como hecho. Si ya estaba finalizado preservamos el
    // timestamp original (es la primera vez que terminó). Si no estaba
    // finalizado y finalize=true, ahora sí.
    // finalize=false (autosave): nunca tocamos finalized_at — preserva
    // lo que haya en BD (null si nunca finalizó, o el timestamp viejo
    // si el cliente vuelve a editar después de finalizar).
    let finalizedAtForWrite: string | null | undefined;

    if (finalize === true) {
      finalizedAtForWrite = existingExerciseLog?.finalized_at
        ? existingExerciseLog.finalized_at
        : new Date().toISOString();
    } else if (!existingExerciseLog) {
      finalizedAtForWrite = null;
    } else {
      // existingExerciseLog && !finalize: no tocar la columna en update
      finalizedAtForWrite = undefined;
    }

    let exerciseLog: any;
    let createError: any;

    if (existingExerciseLog) {
      const updatePayload: any = {
        ...logData,
        completed_at: new Date().toISOString(),
      };

      if (finalizedAtForWrite !== undefined) {
        updatePayload.finalized_at = finalizedAtForWrite;
      }

      const { data, error } = await supabase
        .from("exercise_logs")
        .update(updatePayload)
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
        .insert({ ...logData, finalized_at: finalizedAtForWrite ?? null })
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
        video_url:
          typeof s.videoUrl === "string" && s.videoUrl.trim().length > 0
            ? s.videoUrl
            : null,
      }));

      const { data: insertedSets, error: setsError } = await supabase
        .from("exercise_log_sets")
        .insert(setRows)
        .select("id, set_number, reps, weight_kg, video_url");

      if (setsError) {
        console.error("[Exercise Logs API] Error saving sets:", setsError);
      } else {
        savedSets = insertedSets ?? [];
      }
    }

    // Si todos los logs están FINALIZADOS y cubren los session_exercises
    // del template, marcamos scheduled_sessions.status = 'completed'.
    // Skip en autosave (finalize=false): la sesión no debe pasar a
    // "completed" solo porque haya filas en BD; el cliente todavía
    // está tipeando.
    if (finalize === true) {
      await maybeMarkScheduledCompleted(
        supabase,
        scheduledSessionId,
        sessionId,
        parseInt(clientId)
      );
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

// DELETE — el cliente edita su histórico. Dos modos via query string:
//   ?logId=<uuid>                              → borra un solo registro
//   ?sessionId=<uuid>&scheduledDate=YYYY-MM-DD → borra todos los logs de
//                                                esa sesión en esa fecha
// El cleanup de exercise_log_sets va con un delete explícito porque el
// FK no tiene ON DELETE CASCADE configurado en todas las migraciones.
// El scheduled_sessions row se preserva (solo limpiamos los logs); si
// queda sin logs y la sesión nunca llegó a "completed", queda como
// "scheduled" — comportamiento aceptable y reversible.
export async function DELETE(
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

    if (session.client_id.toString() !== clientId) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const logId = searchParams.get("logId");
    const sessionId = searchParams.get("sessionId");
    const scheduledDate = searchParams.get("scheduledDate");

    let logIdsToDelete: string[] = [];
    let scheduledSessionId: string | null = null;

    if (logId) {
      // Modo single: validamos que el log pertenezca al cliente antes
      // de borrar. RLS ya cubriría esto, pero hacerlo explícito da un
      // error 404 limpio en vez de un 200 con cero filas afectadas.
      const { data: row, error } = await supabase
        .from("exercise_logs")
        .select("id, client_id, scheduled_session_id")
        .eq("id", logId)
        .maybeSingle();

      if (error || !row) {
        return NextResponse.json(
          { success: false, error: "Registro no encontrado" },
          { status: 404 }
        );
      }
      if (row.client_id !== parseInt(clientId)) {
        return NextResponse.json(
          { success: false, error: "No autorizado" },
          { status: 403 }
        );
      }
      logIdsToDelete = [row.id];
      scheduledSessionId = row.scheduled_session_id;
    } else if (sessionId && scheduledDate) {
      // Modo bulk: borrar todos los logs del scheduled_session que
      // matchee (sessionId, scheduledDate, clientId).
      const { data: scheduled, error: scheduledError } = await supabase
        .from("scheduled_sessions")
        .select("id")
        .eq("session_id", sessionId)
        .eq("client_id", parseInt(clientId))
        .eq("scheduled_date", scheduledDate)
        .maybeSingle();

      if (scheduledError || !scheduled) {
        return NextResponse.json(
          { success: false, error: "Entrenamiento no encontrado" },
          { status: 404 }
        );
      }
      scheduledSessionId = scheduled.id;

      const { data: logs, error: logsError } = await supabase
        .from("exercise_logs")
        .select("id")
        .eq("scheduled_session_id", scheduledSessionId)
        .eq("client_id", parseInt(clientId));

      if (logsError) {
        return NextResponse.json(
          { success: false, error: "Error al consultar registros" },
          { status: 500 }
        );
      }
      logIdsToDelete = (logs ?? []).map((l) => l.id);
    } else {
      return NextResponse.json(
        {
          success: false,
          error: "Falta parámetro: pasar logId o (sessionId, scheduledDate)",
        },
        { status: 400 }
      );
    }

    if (logIdsToDelete.length === 0) {
      // Nada que borrar — devolvemos éxito idempotente.
      return NextResponse.json({ success: true, deleted: 0 });
    }

    // Sets primero (FK), luego logs.
    const { error: setsError } = await supabase
      .from("exercise_log_sets")
      .delete()
      .in("exercise_log_id", logIdsToDelete);

    if (setsError) {
      console.error("[Exercise Logs API] Error deleting sets:", setsError);

      return NextResponse.json(
        { success: false, error: "Error al borrar series" },
        { status: 500 }
      );
    }

    const { error: logsError } = await supabase
      .from("exercise_logs")
      .delete()
      .in("id", logIdsToDelete);

    if (logsError) {
      console.error("[Exercise Logs API] Error deleting logs:", logsError);

      return NextResponse.json(
        { success: false, error: "Error al borrar registros" },
        { status: 500 }
      );
    }

    // Si el scheduled_session quedó sin logs y estaba en "completed",
    // lo bajamos a "scheduled" para que el estado refleje la realidad.
    if (scheduledSessionId) {
      const { data: remaining } = await supabase
        .from("exercise_logs")
        .select("id")
        .eq("scheduled_session_id", scheduledSessionId)
        .limit(1);

      if (!remaining || remaining.length === 0) {
        await supabase
          .from("scheduled_sessions")
          .update({ status: "scheduled", completion_date: null })
          .eq("id", scheduledSessionId);
      }
    }

    return NextResponse.json({
      success: true,
      deleted: logIdsToDelete.length,
    });
  } catch (error) {
    console.error("[Exercise Logs API] Unexpected DELETE error:", error);

    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// Marca scheduled_sessions.status = 'completed' cuando los exercise_logs
// del cliente cubren todos los session_exercises del template. Best-effort:
// si algo falla, log y sigue (el guardado del log ya hizo commit).
async function maybeMarkScheduledCompleted(
  supabase: ReturnType<typeof createSupabaseClient>,
  scheduledSessionId: string,
  sessionId: string,
  clientId: number
) {
  try {
    const [{ data: logs, error: logsError }, { data: tmpl, error: tmplError }] =
      await Promise.all([
        supabase
          .from("exercise_logs")
          .select("exercise_id")
          .eq("scheduled_session_id", scheduledSessionId)
          .eq("client_id", clientId)
          // Solo contamos logs FINALIZADOS — autosaves a medias no deben
          // marcar la sesión completa.
          .not("finalized_at", "is", null),
        supabase
          .from("session_exercises")
          .select("exercise_id")
          .eq("session_id", sessionId),
      ]);

    if (logsError || tmplError) {
      console.warn("[Exercise Logs API] completion check fetch failed:", {
        logsError: logsError?.message,
        tmplError: tmplError?.message,
      });

      return;
    }

    const required = new Set((tmpl ?? []).map((r) => r.exercise_id));
    const logged = new Set((logs ?? []).map((r) => r.exercise_id));
    const allCovered =
      required.size > 0 && Array.from(required).every((id) => logged.has(id));

    if (!allCovered) return;

    const { error: updateError } = await supabase
      .from("scheduled_sessions")
      .update({
        status: "completed",
        completion_date: new Date().toISOString(),
      })
      .eq("id", scheduledSessionId)
      .neq("status", "completed");

    if (updateError) {
      console.warn(
        "[Exercise Logs API] failed to mark scheduled_sessions completed:",
        { scheduledSessionId, error: updateError.message }
      );
    }
  } catch (error) {
    console.warn("[Exercise Logs API] completion check threw:", {
      scheduledSessionId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
