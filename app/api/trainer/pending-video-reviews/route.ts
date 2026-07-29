// GET /api/trainer/pending-video-reviews
// Cola transversal del entrenador: videos subidos por CUALQUIERA de sus
// clientes (últimos 90 días) que todavía no tienen fila en
// exercise_video_reviews. Alimenta la tarjeta "Videos por revisar" de la
// página de métricas; la revisión en sí se hace con el PUT por cliente de
// /api/clients/[clientId]/video-reviews.
//
// La derivación video→item reutiliza buildVideoFeed (helper puro del feature
// de Videos) para que las etiquetas de serie sean idénticas a las del tab.

/* eslint-disable no-console */
import type { FeedLog } from "@/features/trainer/training/videos/videos-api";

import { NextResponse } from "next/server";

import { getTrainerSession } from "@/lib/auth/session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";
import {
  buildVideoFeed,
  type VideoFeedItem,
} from "@/features/trainer/training/videos/videos-format";

const LOG_PREFIX = "[Pending Video Reviews API]";
const WINDOW_DAYS = 90;
const MAX_ITEMS = 50;

export interface PendingVideoReview extends VideoFeedItem {
  clientId: number;
  clientName: string;
  clientAvatar: string | null;
}

export async function GET() {
  const correlationId = `req-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const supabase = createSupabaseClient();

  try {
    const session = await getTrainerSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 401 }
      );
    }

    const { data: clients, error: clientsError } = await supabase
      .from("clients")
      .select("id, name, last_name, profile_picture_url")
      .eq("tenant", session.trainer_id);

    if (clientsError) {
      console.error(`${LOG_PREFIX} ${correlationId} clients fetch failed:`, {
        error: clientsError.message,
      });

      return NextResponse.json(
        { success: false, error: "Error al obtener clientes" },
        { status: 500 }
      );
    }

    const clientIds = (clients ?? []).map((c) => c.id as number);

    if (clientIds.length === 0) {
      return NextResponse.json({ success: true, pending: [], totalPending: 0 });
    }

    const from = new Date();

    from.setDate(from.getDate() - WINDOW_DAYS);
    const fromYmd = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, "0")}-${String(from.getDate()).padStart(2, "0")}`;

    // Solo logs que PUEDEN traer video: o en sets o a nivel de log. El filtro
    // fino (URL no vacía, dedupe, legacy) lo hace buildVideoFeed.
    const { data: logs, error: logsError } = await supabase
      .from("exercise_logs")
      .select(
        "id, client_id, exercise_id, video_url, exercises(id, name), scheduled_sessions!inner(scheduled_date, session_id), exercise_log_sets(set_number, reps, weight_kg, video_url)"
      )
      .in("client_id", clientIds)
      .gte("scheduled_sessions.scheduled_date", fromYmd)
      .order("completed_at", { ascending: false })
      .limit(1500);

    if (logsError) {
      console.error(`${LOG_PREFIX} ${correlationId} logs fetch failed:`, {
        error: logsError.message,
      });

      return NextResponse.json(
        { success: false, error: "Error al obtener videos" },
        { status: 500 }
      );
    }

    const reviewed = await loadReviewedUrls(supabase, clientIds, correlationId);

    const clientById = new Map(
      (clients ?? []).map((c) => [
        Number(c.id),
        {
          name: [c.name, c.last_name].filter(Boolean).join(" ").trim(),
          avatar: (c.profile_picture_url as string | null) ?? null,
        },
      ])
    );

    // buildVideoFeed trabaja por cliente (dedupe por URL y orden por fecha);
    // las URLs llevan el clientId en el path, así que mezclar clientes en una
    // sola pasada no colisiona.
    const feedLogs: FeedLog[] = (logs ?? []).map((log: any) => ({
      id: log.id,
      exercise_id: log.exercise_id,
      exercises: log.exercises ?? null,
      scheduled_date: log.scheduled_sessions?.scheduled_date ?? null,
      session_id: log.scheduled_sessions?.session_id ?? null,
      video_url: log.video_url ?? null,
      sets: log.exercise_log_sets ?? [],
    }));

    const ownerByLogId = new Map<string, number>(
      (logs ?? []).map((log: any) => [log.id as string, Number(log.client_id)])
    );

    const pending: PendingVideoReview[] = [];

    for (const item of buildVideoFeed(feedLogs)) {
      if (reviewed.has(item.videoUrl)) continue;

      const ownerId = ownerByLogId.get(item.exerciseLogId);

      if (ownerId === undefined) continue;

      const client = clientById.get(ownerId);

      pending.push({
        ...item,
        clientId: ownerId,
        clientName: client?.name ?? "Cliente",
        clientAvatar: client?.avatar ?? null,
      });
    }

    return NextResponse.json({
      success: true,
      pending: pending.slice(0, MAX_ITEMS),
      totalPending: pending.length,
    });
  } catch (error) {
    console.error(`${LOG_PREFIX} ${correlationId} unexpected error:`, error);

    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// URLs ya revisadas de estos clientes. 42P01 (tabla sin crear todavía en un
// entorno) degrada a "nada revisado" — la cola sigue funcionando.
async function loadReviewedUrls(
  supabase: ReturnType<typeof createSupabaseClient>,
  clientIds: number[],
  correlationId: string
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("exercise_video_reviews")
    .select("video_url")
    .in("client_id", clientIds);

  if (error) {
    if (error.code !== "42P01") {
      console.warn(`${LOG_PREFIX} ${correlationId} reviews fetch failed:`, {
        error: error.message,
      });
    }

    return new Set();
  }

  return new Set((data ?? []).map((row) => row.video_url as string));
}
