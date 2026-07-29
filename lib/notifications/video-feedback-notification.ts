// Builder para la fila de `notifications` que avisa al cliente de que su
// entrenador comentó un video suyo. Sigue las mismas convenciones que
// chat-notification.ts:
//   - tenant_slug guarda el SLUG (el GET de notificaciones en modo cliente
//     filtra por el slug de la URL, no por el host).
//   - client_id es NOT NULL en la tabla; metadata.audience es lo que decide
//     qué campana puede mostrar la fila.
//
// El comentario viaja DOS veces: recortado en `message` (lo que se lee en la
// campana) y completo en metadata.comment (lo que abre el visor del video).

import { truncateForNotification } from "./chat-notification";

export interface VideoFeedbackNotificationRow {
  tenant_slug: string;
  client_id: number;
  trainer_id: string;
  type: "video_feedback";
  title: string;
  message: string;
  icon: string;
  metadata: {
    audience: "client";
    action: "open_video_feedback";
    video_url: string;
    exercise_name: string;
    /** Ej. "Serie 3 · 8 reps × 80 kg" — identifica la serie del video. */
    set_label: string;
    /** YYYY-MM-DD de la sesión donde se subió el video. */
    scheduled_date: string;
    /** Texto completo del comentario; el visor lo lee de aquí. */
    comment: string;
  };
}

export function buildVideoFeedbackNotificationRow(args: {
  tenantSlug: string;
  clientId: number;
  trainerId: string;
  videoUrl: string;
  exerciseName: string;
  setLabel: string;
  scheduledDate: string;
  comment: string;
}): VideoFeedbackNotificationRow {
  return {
    tenant_slug: args.tenantSlug,
    client_id: args.clientId,
    trainer_id: args.trainerId,
    type: "video_feedback",
    title: "Tu coach comentó tu video",
    message: truncateForNotification(args.comment),
    icon: "solar:videocamera-record-broken",
    metadata: {
      audience: "client",
      action: "open_video_feedback",
      video_url: args.videoUrl,
      exercise_name: args.exerciseName,
      set_label: args.setLabel,
      scheduled_date: args.scheduledDate,
      comment: args.comment,
    },
  };
}
