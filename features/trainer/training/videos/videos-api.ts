// Capa de datos de la rebanada "Videos" del tab Entrenamiento.
//
// El feed reutiliza la ruta de logs del trainer
// (/api/clients/[clientId]/exercise-logs/trainer) porque los videos viven
// dentro de los logs: uno por serie (exercise_log_sets.video_url) y, en datos
// antiguos, uno a nivel de log (exercise_logs.video_url). Esa ruta devuelve la
// lista aplanada bajo la clave `exerciseLogs` — leemos también `logs` por si el
// backend renombra la clave, y `videoReviews` con el mapa de revisiones.
//
// Mismas convenciones que training-api.ts: respuestas {success, <clave>} (sin
// envelope `data`), errores como clase con status para que la UI ramifique.

export interface VideoReviewEntry {
  reviewed_at: string;
  comment: string | null;
}

/** Revisiones indexadas por URL de video. Ausente = sin revisar. */
export type VideoReviewMap = Record<string, VideoReviewEntry>;

export interface FeedLogSet {
  id?: string | null;
  set_number: number;
  reps: number | null;
  weight_kg: number | null;
  video_url?: string | null;
}

/** Log aplanado tal como lo entrega la ruta de logs del trainer. */
export interface FeedLog {
  id: string;
  exercise_id: string;
  exercises?: { id: string; name: string; category?: string } | null;
  scheduled_date?: string | null;
  session_id?: string | null;
  /** Video legacy a nivel de log (antes de los videos por serie). */
  video_url?: string | null;
  sets?: FeedLogSet[] | null;
}

export interface VideoFeed {
  logs: FeedLog[];
  videoReviews: VideoReviewMap;
}

/** Cuerpo del PUT de revisión; `context` alimenta la notificación al cliente. */
export interface VideoReviewInput {
  videoUrl: string;
  reviewed: boolean;
  comment?: string | null;
  exerciseLogId?: string;
  context?: {
    exerciseName: string;
    setLabel: string;
    scheduledDate: string;
  };
}

/** Fila devuelta por el PUT; solo la usamos como confirmación. */
export interface VideoReviewResult {
  reviewed_at?: string | null;
  comment?: string | null;
}

/** Lleva el status HTTP para que el caller pueda ramificar (404, 409, ...). */
export class VideosApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "VideosApiError";
    this.status = status;
  }
}

async function readBody<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => null);

  if (response.ok === false || data?.success !== true) {
    throw new VideosApiError(data?.error ?? "Error de red", response.status);
  }

  return data as T;
}

function getJson<T>(url: string): Promise<T> {
  return fetch(url, { credentials: "same-origin", cache: "no-store" }).then(
    readBody<T>
  );
}

function sendJson<T>(
  url: string,
  method: "POST" | "PATCH" | "PUT" | "DELETE",
  body?: Record<string, unknown>
): Promise<T> {
  return fetch(url, {
    method,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  }).then(readBody<T>);
}

/**
 * Logs del último año + mapa de revisiones. La ventana de 365 días es el
 * historial de videos que tiene sentido revisar; la ruta corta a 2000 logs.
 */
export function fetchVideoFeed(clientId: string): Promise<VideoFeed> {
  return getJson<{
    exerciseLogs?: FeedLog[];
    logs?: FeedLog[];
    videoReviews?: VideoReviewMap;
  }>(`/api/clients/${clientId}/exercise-logs/trainer?days=365`).then(
    (body) => ({
      logs: body.exerciseLogs ?? body.logs ?? [],
      videoReviews: body.videoReviews ?? {},
    })
  );
}

/** Marca/desmarca revisado y guarda el comentario del coach para ese video. */
export function putVideoReview(
  clientId: string,
  input: VideoReviewInput
): Promise<VideoReviewResult | null> {
  return sendJson<{ review?: VideoReviewResult | null }>(
    `/api/clients/${clientId}/video-reviews`,
    "PUT",
    {
      videoUrl: input.videoUrl,
      reviewed: input.reviewed,
      ...(input.comment !== undefined ? { comment: input.comment } : {}),
      ...(input.exerciseLogId !== undefined
        ? { exerciseLogId: input.exerciseLogId }
        : {}),
      ...(input.context !== undefined ? { context: input.context } : {}),
    }
  ).then((body) => body.review ?? null);
}
