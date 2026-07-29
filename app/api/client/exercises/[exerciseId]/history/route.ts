// GET /api/client/exercises/[exerciseId]/history?limit=3
// Devuelve las últimas N sesiones del cliente para un ejercicio dado,
// más el PR (mejor marca histórica). El PR se calcula al vuelo sobre
// exercise_log_sets — la tabla personal_records existe pero está dormida
// (ver §7.5 de bloque-1-spec.md).

/* eslint-disable no-console */
import type {
  ExerciseHistoryEntry,
  ExerciseHistoryResponse,
} from "@/types/training";

import { NextRequest, NextResponse } from "next/server";

import { getClientSession } from "@/lib/auth/client-session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";

const LOG_PREFIX = "[Exercise History API]";
const DEFAULT_LIMIT = 3;
const MAX_LIMIT = 20;

interface RouteContext {
  params: Promise<{ exerciseId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  const correlationId = `req-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const supabase = createSupabaseClient();

  try {
    const session = await getClientSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 401 }
      );
    }

    const { exerciseId } = await params;
    const { searchParams } = new URL(request.url);
    const limit = parseLimit(searchParams.get("limit"));

    const { data: logs, error: logsError } = await supabase
      .from("exercise_logs")
      .select(
        "id, completed_at, notes, scheduled_sessions!inner(scheduled_date), exercise_log_sets(set_number, reps, weight_kg, video_url)"
      )
      .eq("client_id", session.client_id)
      .eq("exercise_id", exerciseId)
      .order("completed_at", { ascending: false })
      .limit(limit);

    if (logsError) {
      console.error(`${LOG_PREFIX} Error fetching exercise_logs:`, {
        correlationId,
        clientId: session.client_id,
        exerciseId,
        error: logsError.message,
      });

      return NextResponse.json(
        { success: false, error: "Error al obtener el historial" },
        { status: 500 }
      );
    }

    // Comentarios del coach sobre los videos, por URL de video: los ids de
    // exercise_log_sets se reinsertan en cada autosave, la URL no cambia.
    const coachComments = await loadCoachComments(
      supabase,
      session.client_id,
      correlationId
    );

    const recent: ExerciseHistoryEntry[] = (logs ?? []).map((log: any) => {
      const setsRaw = (log.exercise_log_sets ?? []) as Array<{
        set_number: number;
        reps: number | null;
        weight_kg: number | null;
        video_url: string | null;
      }>;

      const sets = setsRaw
        .filter((s) => s.reps !== null)
        .sort((a, b) => a.set_number - b.set_number)
        .map((s) => {
          const videoUrl = s.video_url ?? null;

          return {
            set_number: s.set_number,
            reps: s.reps as number,
            weight_kg: s.weight_kg ?? null,
            video_url: videoUrl,
            coach_comment:
              videoUrl === null ? null : (coachComments[videoUrl] ?? null),
          };
        });

      const notes = typeof log.notes === "string" ? log.notes.trim() : "";

      return {
        scheduled_date: log.scheduled_sessions?.scheduled_date ?? "",
        exercise_log_id: log.id,
        sets,
        // El comentario que el cliente dejó ese día ("me costó la última
        // serie") — se muestra en el historial para que pueda compararse.
        notes: notes.length > 0 ? notes : null,
      };
    });

    const pr = await loadPersonalRecord(
      supabase,
      session.client_id,
      exerciseId,
      correlationId
    );

    const response: ExerciseHistoryResponse = {
      exercise_id: exerciseId,
      recent,
      pr,
    };

    return NextResponse.json({ success: true, ...response });
  } catch (error) {
    console.error(`${LOG_PREFIX} Unexpected error:`, {
      correlationId,
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

function parseLimit(raw: string | null): number {
  if (!raw) return DEFAULT_LIMIT;
  const parsed = parseInt(raw, 10);

  if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_LIMIT;

  return Math.min(parsed, MAX_LIMIT);
}

// Comentarios del entrenador indexados por URL de video. Solo se devuelven
// las revisiones que llevan texto — una revisión sin comentario no aporta
// nada al cliente. Si la tabla todavía no existe (migración pendiente de
// aplicar a mano), el historial se sirve sin comentarios. 42P01 =
// undefined_table.
async function loadCoachComments(
  supabase: ReturnType<typeof createSupabaseClient>,
  clientId: string,
  correlationId: string
): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from("exercise_video_reviews")
    .select("video_url, comment")
    .eq("client_id", clientId);

  if (error) {
    if (error.code !== "42P01") {
      console.warn(`${LOG_PREFIX} Failed to load coach comments:`, {
        correlationId,
        clientId,
        error: error.message,
      });
    }

    return {};
  }

  const map: Record<string, string> = {};

  for (const row of data ?? []) {
    const comment = typeof row.comment === "string" ? row.comment.trim() : "";

    if (comment !== "") {
      map[row.video_url] = comment;
    }
  }

  return map;
}

// Calcula el PR sobre exercise_log_sets: set con weight_kg más alto, con
// desempate por reps. Devuelve también la fecha de la sesión que ganó
// (scheduled_sessions.scheduled_date del exercise_log padre).
// Si el cliente todavía no tiene sets registrados con peso → null.

async function loadPersonalRecord(
  supabase: ReturnType<typeof createSupabaseClient>,
  clientId: string,
  exerciseId: string,
  correlationId: string
): Promise<ExerciseHistoryResponse["pr"]> {
  const { data, error } = await supabase
    .from("exercise_log_sets")
    .select(
      "reps, weight_kg, exercise_logs!inner(client_id, exercise_id, scheduled_sessions!inner(scheduled_date))"
    )
    .eq("exercise_logs.client_id", clientId)
    .eq("exercise_logs.exercise_id", exerciseId)
    .not("weight_kg", "is", null)
    .order("weight_kg", { ascending: false, nullsFirst: false })
    .order("reps", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn(`${LOG_PREFIX} Failed to compute PR, returning null:`, {
      correlationId,
      clientId,
      exerciseId,
      error: error.message,
    });

    return null;
  }

  if (!data || data.weight_kg === null) return null;

  const log = (data as any).exercise_logs;
  const achievedAt: string = log?.scheduled_sessions?.scheduled_date ?? "";

  const reps = data.reps ?? 0;

  return {
    weight_kg: data.weight_kg as number,
    reps,
    achieved_at: achievedAt,
  };
}
