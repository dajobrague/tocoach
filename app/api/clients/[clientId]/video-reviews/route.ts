// PUT /api/clients/[clientId]/video-reviews
// El entrenador marca (o desmarca) como revisado el video de una serie y
// opcionalmente deja un comentario. El estado se guarda por URL de video
// porque `exercise_log_sets` se borra y reinserta en cada autosave del
// cliente — ningún id de set sobrevive.
//
// Desmarcar borra la fila: la ausencia es la única representación de
// "sin revisar" (y es idempotente).

/* eslint-disable no-console */
import { NextRequest, NextResponse } from "next/server";

import { getTrainerSession } from "@/lib/auth/session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";
import { buildVideoFeedbackNotificationRow } from "@/lib/notifications/video-feedback-notification";

const LOG_PREFIX = "[Video Reviews API]";
const TABLE = "exercise_video_reviews";

interface RouteContext {
  params: Promise<{ clientId: string }>;
}

interface VideoReviewContext {
  exerciseName: string;
  setLabel: string;
  scheduledDate: string;
}

interface VideoReviewBody {
  videoUrl: string;
  reviewed: boolean;
  comment: string | null;
  /** false = el body no traía `comment` → preservar el comentario previo. */
  commentProvided: boolean;
  exerciseLogId?: string;
  context?: VideoReviewContext;
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
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

    const { clientId } = await params;
    const body = parseBody(await readJson(request));

    if (!body) {
      return NextResponse.json(
        { success: false, error: "Datos inválidos" },
        { status: 400 }
      );
    }

    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("id, tenant")
      .eq("id", clientId)
      .single();

    if (clientError || !client || client.tenant !== session.trainer_id) {
      console.warn(
        `${LOG_PREFIX} ${correlationId} client not owned by trainer`,
        {
          clientId,
          trainerId: session.trainer_id,
        }
      );

      return NextResponse.json(
        { success: false, error: "Cliente no encontrado" },
        { status: 404 }
      );
    }

    // Desmarcar: borrar la fila. Borrar algo que no existe también es éxito.
    if (!body.reviewed) {
      const { error: deleteError } = await supabase
        .from(TABLE)
        .delete()
        .eq("client_id", clientId)
        .eq("video_url", body.videoUrl);

      if (deleteError) {
        console.error(
          `${LOG_PREFIX} ${correlationId} delete failed:`,
          deleteError
        );

        return NextResponse.json(
          { success: false, error: "Error al actualizar la revisión" },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true, review: null });
    }

    // El tenant_host vive en la fila del entrenador (clients no lo expone).
    const { data: trainer, error: trainerError } = await supabase
      .from("trainers")
      .select("tenant_host")
      .eq("id", session.trainer_id)
      .single();

    if (trainerError || !trainer?.tenant_host) {
      console.error(
        `${LOG_PREFIX} ${correlationId} trainer tenant_host not found:`,
        trainerError
      );

      return NextResponse.json(
        { success: false, error: "Entrenador no encontrado" },
        { status: 404 }
      );
    }

    // Se lee la fila previa para saber si ya tenía comentario: editar un
    // comentario existente NO vuelve a notificar.
    const { data: previous } = await supabase
      .from(TABLE)
      .select("comment")
      .eq("client_id", clientId)
      .eq("video_url", body.videoUrl)
      .maybeSingle();

    const hadComment =
      typeof previous?.comment === "string" && previous.comment.trim() !== "";

    // Body sin campo `comment` = "no tocar el comentario": se preserva el
    // previo. Mandar comment vacío/null sigue borrándolo explícitamente.
    const commentForWrite = body.commentProvided
      ? body.comment
      : (previous?.comment ?? null);

    const { data: saved, error: upsertError } = await supabase
      .from(TABLE)
      .upsert(
        {
          tenant_host: trainer.tenant_host,
          client_id: Number(clientId),
          trainer_id: session.trainer_id,
          video_url: body.videoUrl,
          comment: commentForWrite,
          ...(body.exerciseLogId
            ? { exercise_log_id: body.exerciseLogId }
            : {}),
          reviewed_at: new Date().toISOString(),
        },
        { onConflict: "client_id,video_url" }
      )
      .select("video_url, reviewed_at, comment")
      .single();

    if (upsertError || !saved) {
      console.error(
        `${LOG_PREFIX} ${correlationId} upsert failed:`,
        upsertError
      );

      return NextResponse.json(
        { success: false, error: "Error al guardar la revisión" },
        { status: 500 }
      );
    }

    const reviewContext = body.context;

    // Notifica al cliente solo cuando aparece un comentario nuevo (no en
    // ediciones ni al marcar sin texto). Fire-and-forget: la revisión ya está
    // guardada y no puede fallar por la campana.
    if (body.comment && !hadComment && reviewContext) {
      const comment = body.comment;

      void (async () => {
        const { data: tenantRow } = await supabase
          .from("tenants")
          .select("slug")
          .eq("host", trainer.tenant_host)
          .maybeSingle();

        if (!tenantRow?.slug) {
          console.warn(
            `${LOG_PREFIX} ${correlationId} no tenant slug for host — skipping video feedback notification`
          );

          return;
        }

        const { error: notifError } = await supabase
          .from("notifications")
          .insert(
            buildVideoFeedbackNotificationRow({
              tenantSlug: tenantRow.slug,
              clientId: Number(clientId),
              trainerId: session.trainer_id,
              videoUrl: body.videoUrl,
              exerciseName: reviewContext.exerciseName,
              setLabel: reviewContext.setLabel,
              scheduledDate: reviewContext.scheduledDate,
              comment,
            })
          );

        if (notifError) {
          console.error(
            `${LOG_PREFIX} ${correlationId} video feedback notification insert failed:`,
            notifError
          );
        }
      })().catch((e) => {
        console.error(
          `${LOG_PREFIX} ${correlationId} video feedback notification failed:`,
          e
        );
      });
    }

    return NextResponse.json({
      success: true,
      review: {
        video_url: saved.video_url,
        reviewed_at: saved.reviewed_at,
        comment: saved.comment ?? null,
      },
    });
  } catch (error) {
    console.error(`${LOG_PREFIX} ${correlationId} unexpected error:`, error);

    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

async function readJson(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

/** Valida y normaliza el body; null si la forma no sirve (→ 400). */
function parseBody(raw: unknown): VideoReviewBody | null {
  if (typeof raw !== "object" || raw === null) return null;

  const input = raw as Record<string, unknown>;
  const videoUrl =
    typeof input.videoUrl === "string" ? input.videoUrl.trim() : "";

  if (videoUrl === "") return null;
  if (typeof input.reviewed !== "boolean") return null;

  // Tres estados del comentario: ausente (no tocar el existente), string con
  // texto (set) o vacío/null explícito (borrar). Vacío o solo espacios = null.
  const commentProvided = "comment" in input;
  const rawComment = input.comment;
  const trimmedComment =
    typeof rawComment === "string" ? rawComment.trim() : "";
  const comment = trimmedComment === "" ? null : trimmedComment;

  const exerciseLogId =
    typeof input.exerciseLogId === "string" && input.exerciseLogId !== ""
      ? input.exerciseLogId
      : null;
  const context = parseContext(input.context);

  return {
    videoUrl,
    reviewed: input.reviewed,
    comment,
    commentProvided,
    ...(exerciseLogId === null ? {} : { exerciseLogId }),
    ...(context === null ? {} : { context }),
  };
}

function parseContext(raw: unknown): VideoReviewContext | null {
  if (typeof raw !== "object" || raw === null) return null;

  const input = raw as Record<string, unknown>;

  if (
    typeof input.exerciseName !== "string" ||
    typeof input.setLabel !== "string" ||
    typeof input.scheduledDate !== "string"
  ) {
    return null;
  }

  return {
    exerciseName: input.exerciseName,
    setLabel: input.setLabel,
    scheduledDate: input.scheduledDate,
  };
}
