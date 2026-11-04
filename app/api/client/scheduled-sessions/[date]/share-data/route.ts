// GET /api/client/scheduled-sessions/[date]/share-data?sessionId=…
// Datos para "Compartir" (llamada JC, 14 oct): la sesión del cliente con sus
// series, récords, músculos y vídeos, más la firma del entrenador. La imagen
// la dibuja el móvil del cliente (vista previa al instante, mismo PNG que
// exporta); aquí solo se leen datos. El logo viaja como PNG en data URI para
// que el canvas del cliente pueda pintarlo sin CORS.
//
// Scoping: todo se filtra por el client_id de la sesión del cliente.

/* eslint-disable no-console */
import type { SessionSets, SetInput } from "@/lib/training/e1rm";

import { NextRequest, NextResponse } from "next/server";

import { getClientSession } from "@/lib/auth/client-session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";
import { loadShareCardBranding } from "@/lib/share-card/branding";
import {
  type ShareLogInput,
  type SharePayload,
  buildShareExercises,
} from "@/lib/share-card/session-data";
import { shareCardSettingsFromFeatures } from "@/lib/share-card/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LOG_PREFIX = "[Share Data API]";
const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

function legacySets(log: {
  sets_completed: number | null;
  reps_completed: string | null;
  weight_kg: number | null;
}): SetInput[] {
  const reps = /\d+/.exec(log.reps_completed ?? "")?.[0];

  return Array.from({ length: log.sets_completed ?? 0 }, () => ({
    reps: reps !== undefined ? parseInt(reps, 10) : null,
    weight_kg: log.weight_kg,
  }));
}

function toNumber(value: unknown): number | null {
  const n = typeof value === "string" ? parseFloat(value) : value;

  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

function pickOne<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ date: string }> }
) {
  const correlationId = `req-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  try {
    const session = await getClientSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 401 }
      );
    }

    const { date } = await params;
    const sessionId = request.nextUrl.searchParams.get("sessionId");

    if (!YMD_RE.test(date) || !sessionId) {
      return NextResponse.json(
        { success: false, error: "Fecha o sesión inválida" },
        { status: 400 }
      );
    }

    const supabase = createSupabaseClient();
    const clientId = parseInt(String(session.client_id), 10);

    const { data: tenant } = await supabase
      .from("tenants")
      .select("logo_url, theme_json, features")
      .eq("slug", session.tenant_slug)
      .maybeSingle();
    const settings = shareCardSettingsFromFeatures(tenant?.features);

    if (!settings.enabled) {
      return NextResponse.json(
        { success: false, error: "Tu entrenador ha desactivado esta opción" },
        { status: 404 }
      );
    }

    const { data: row, error: rowError } = await supabase
      .from("scheduled_sessions")
      .select("id, scheduled_time, completion_date, session:sessions(name)")
      .eq("client_id", clientId)
      .eq("scheduled_date", date)
      .eq("session_id", sessionId)
      .maybeSingle();

    if (rowError || !row) {
      if (rowError) {
        console.error(`${LOG_PREFIX} row fetch error:`, {
          correlationId,
          error: rowError.message,
        });
      }

      return NextResponse.json(
        { success: false, error: "Sesión no encontrada" },
        { status: 404 }
      );
    }

    const [logsResult, countResult, branding] = await Promise.all([
      supabase
        .from("exercise_logs")
        .select(
          "id, exercise_id, sets_completed, reps_completed, weight_kg, duration_seconds, distance_meters, exercise:exercises(name, primary_muscles, secondary_muscles), exercise_log_sets(set_number, reps, weight_kg, video_url)"
        )
        .eq("client_id", clientId)
        .eq("scheduled_session_id", row.id)
        .not("finalized_at", "is", null)
        .order("created_at", { ascending: true }),
      supabase
        .from("scheduled_sessions")
        .select("id", { count: "exact", head: true })
        .eq("client_id", clientId)
        .eq("status", "completed")
        .lte("scheduled_date", date),
      loadShareCardBranding(tenant, correlationId),
    ]);

    if (logsResult.error) {
      console.error(`${LOG_PREFIX} logs fetch error:`, {
        correlationId,
        error: logsResult.error.message,
      });

      return NextResponse.json(
        { success: false, error: "Error al leer la sesión" },
        { status: 500 }
      );
    }

    const logs: ShareLogInput[] = (logsResult.data ?? []).map((log: any) => {
      const rows = ((log.exercise_log_sets ?? []) as any[]).sort(
        (a, b) => (a.set_number ?? 0) - (b.set_number ?? 0)
      );
      const exercise = pickOne<{
        name?: string;
        primary_muscles?: unknown;
        secondary_muscles?: unknown;
      }>(log.exercise);

      return {
        id: String(log.id),
        exerciseId: log.exercise_id,
        name: exercise?.name ?? "Ejercicio",
        primaryMuscles: exercise?.primary_muscles ?? [],
        secondaryMuscles: exercise?.secondary_muscles ?? [],
        sets:
          rows.length > 0
            ? rows.map((set) => ({
                reps: toNumber(set.reps),
                weight_kg: toNumber(set.weight_kg),
              }))
            : legacySets({
                sets_completed: log.sets_completed,
                reps_completed: log.reps_completed,
                weight_kg: toNumber(log.weight_kg),
              }),
        videoUrls: rows.map((set) =>
          typeof set.video_url === "string" ? set.video_url : null
        ),
        durationSeconds: toNumber(log.duration_seconds),
        distanceMeters: toNumber(log.distance_meters),
      };
    });

    // Historial de los mismos ejercicios en días ANTERIORES (récords).
    // Best-effort: si falla, la imagen sale sin récords.
    const priorByExercise = new Map<string, SessionSets[]>();
    const exerciseIds = [...new Set(logs.map((log) => log.exerciseId))];

    if (exerciseIds.length > 0) {
      const { data: prior, error: priorError } = await supabase
        .from("exercise_logs")
        .select(
          "exercise_id, scheduled_sessions!inner(scheduled_date), exercise_log_sets(reps, weight_kg)"
        )
        .eq("client_id", clientId)
        .in("exercise_id", exerciseIds)
        .not("finalized_at", "is", null)
        .lt("scheduled_sessions.scheduled_date", date)
        .limit(5000);

      if (priorError) {
        console.warn(`${LOG_PREFIX} prior logs failed:`, {
          correlationId,
          error: priorError.message,
        });
      }

      for (const log of (prior ?? []) as any[]) {
        const day = pickOne<{ scheduled_date?: string }>(
          log.scheduled_sessions
        )?.scheduled_date;

        if (!day) continue;
        const list = priorByExercise.get(log.exercise_id) ?? [];

        list.push({
          date: day,
          sets: ((log.exercise_log_sets ?? []) as any[]).map((set) => ({
            reps: toNumber(set.reps),
            weight_kg: toNumber(set.weight_kg),
          })),
        });
        priorByExercise.set(log.exercise_id, list);
      }
    }

    const payload: SharePayload = {
      branding: {
        name: settings.displayName || branding.trainerName,
        instagram: settings.instagram,
        brandColor: branding.brandColor,
        logoSrc: branding.logoSrc,
        showTopcoach: settings.showTopcoach,
        footer: settings.footer,
      },
      session: {
        sessionName:
          pickOne<{ name?: string }>(row.session as any)?.name ??
          "Entrenamiento",
        date,
        sessionNumber: countResult.count ?? null,
        startTime:
          typeof row.scheduled_time === "string"
            ? row.scheduled_time.slice(0, 5)
            : null,
        completedAt: row.completion_date ?? null,
        exercises: buildShareExercises(logs, priorByExercise),
      },
    };

    return NextResponse.json(
      { success: true, data: payload },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    console.error(`${LOG_PREFIX} unexpected error:`, {
      correlationId,
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
